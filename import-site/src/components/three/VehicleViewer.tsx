"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  environmentOptions,
  getVehicleModel,
  paintOptions,
  wheelFinishOptions,
  type EnvironmentId,
} from "@/config/vehicle-models";
import { Light, Plus, Rotate } from "@/components/ui/icons";
import { DynamicEnvironment, PaletteTarget } from "./DynamicEnvironment";
import { Backdrop, FloorFade, FloorGlow, HeadlightGlow, setHeadlightGlow, type BackdropHandle } from "./StageFx";
import { createVehicleMaterials, findPaint, findWheel, lerpPaint, lerpWheel } from "./vehicle-materials";
import { VehicleModel, type VehicleHandles } from "./VehicleModel";
import s from "./VehicleViewer.module.css";

type View = "front" | "side" | "rear" | "top" | "free";
const VIEW_POS: Record<Exclude<View, "free">, [number, number, number]> = {
  front: [3.6, 1.2, 5.6],
  side: [7, 1.1, 0.01],
  rear: [-3.6, 1.4, -5.6],
  top: [0.01, 8.5, 0.6],
};

interface ViewerState {
  paint: string;
  wheel: string;
  env: EnvironmentId;
  lights: boolean;
  view: View;
  zoom: number;
}

function Scene({ modelId, state, onReady }: { modelId: string; state: ViewerState; onReady: () => void }) {
  const model = getVehicleModel(modelId)!;
  const materials = useMemo(() => createVehicleMaterials(), []);
  const handles = useRef<VehicleHandles>({ wheels: [], plate: null });
  const palette = useMemo(() => new PaletteTarget("studio"), []);
  const backdrop = useRef<BackdropHandle>(null!);
  const glow = useRef<THREE.Group>(null!);
  const controls = useRef<OrbitControlsImpl>(null!);
  const [envTex, setEnvTex] = useState<THREE.Texture | null>(null);
  const onTex = useCallback((t: THREE.Texture) => setEnvTex(t), []);
  const { camera } = useThree();
  const flying = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!envTex) return;
    for (const m of Object.values(materials)) {
      m.envMap = envTex;
      m.needsUpdate = true;
    }
  }, [envTex, materials]);

  useEffect(() => {
    if (state.view !== "free") flying.current = new THREE.Vector3(...VIEW_POS[state.view]);
  }, [state.view]);

  useEffect(() => {
    // Zoom buttons dolly along the view ray.
    const c = controls.current;
    if (!c) return;
    const dir = camera.position.clone().sub(c.target);
    const len = THREE.MathUtils.clamp(dir.length() * (state.zoom > 0 ? 0.85 : 1.18), 3.2, 12);
    flying.current = c.target.clone().add(dir.setLength(len));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to explicit zoom presses only
  }, [state.zoom]);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 3);
    palette.set(state.env === "dusk" ? "dusk" : state.env === "night" ? "night" : "studio");
    lerpPaint(materials.paint, findPaint(state.paint), k);
    lerpWheel(materials.rims, findWheel(state.wheel), k);
    const on = state.lights ? 1 : 0;
    materials.headlights.emissiveIntensity += (on * 5 - materials.headlights.emissiveIntensity) * k;
    materials.taillights.emissiveIntensity += (on * 3 - materials.taillights.emissiveIntensity) * k;
    setHeadlightGlow(glow.current, materials.headlights.emissiveIntensity / 5);
    const bu = backdrop.current?.uniforms;
    if (bu) {
      bu.uGlowStrength.value = state.env === "studio" ? 0.4 : 0.25;
      bu.uHorizonStrength.value = state.env === "dusk" ? 1 : 0;
      bu.uGlow.value.set(state.env === "dusk" ? "#4a2a22" : state.env === "night" ? "#18213a" : "#454a53");
    }
    if (flying.current) {
      camera.position.lerp(flying.current, k * 1.4);
      if (camera.position.distanceTo(flying.current) < 0.02) flying.current = null;
      controls.current?.update();
    }
  });

  const [hx, hy, hz] = model.anchors.headlight;

  return (
    <>
      <DynamicEnvironment target={palette} onTexture={onTex} />
      <Backdrop ref={backdrop} />
      <directionalLight position={[-5, 7, 6]} intensity={1} />
      <Suspense fallback={null}>
        <VehicleModel model={model} materials={materials} handles={handles} />
        <Ready onReady={onReady} />
      </Suspense>
      <HeadlightGlow ref={glow} positions={[[hx, hy, hz], [-hx, hy, hz]]} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#060607" roughness={0.4} metalness={0.5} envMap={envTex} envMapIntensity={0.06} />
      </mesh>
      <FloorGlow />
      <FloorFade />
      <OrbitControls
        ref={controls as never}
        makeDefault
        target={[0, 0.55, 0]}
        enablePan={false}
        enableZoom={false}
        minDistance={3.2}
        maxDistance={12}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.04}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.6}
        onStart={() => {
          flying.current = null;
        }}
      />
    </>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

/**
 * Interactive studio for any vehicle with a registered 3D model: orbit,
 * zoom, camera presets, paint, wheels, environment and lights.
 * Wheel-zoom is left to the page so scrolling never gets trapped — the
 * zoom buttons dolly the camera instead.
 */
export default function VehicleViewer({ modelId, initialPaint }: { modelId: string; initialPaint?: string }) {
  const [state, setState] = useState<ViewerState>({
    paint: initialPaint ?? "graphite",
    wheel: "satin-black",
    env: "studio",
    lights: false,
    view: "front",
    zoom: 0,
  });
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const wrap = useRef<HTMLDivElement>(null);
  const zoomTick = useRef(0);

  const patch = (p: Partial<ViewerState>) => setState((st) => ({ ...st, ...p }));

  return (
    <div ref={wrap} className={s.viewer} data-ready={ready} data-cursor="drag">
      <Canvas
        className={s.canvas}
        dpr={[1, 2]}
        camera={{ fov: 30, position: [3.6, 1.2, 5.6], near: 0.05, far: 300 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          scene.background = new THREE.Color("#030304");
        }}
      >
        <Scene modelId={modelId} state={state} onReady={onReady} />
      </Canvas>

      {!ready && <div className={s.loading}>Preparing studio…</div>}

      <div className={s.controls} data-cursor="">
        <div className={s.group} role="group" aria-label="Paint">
          {paintOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              className={s.swatch}
              style={{ "--c": p.color } as React.CSSProperties}
              aria-pressed={state.paint === p.id}
              aria-label={p.name}
              title={p.name}
              onClick={() => patch({ paint: p.id })}
            />
          ))}
        </div>
        <div className={s.group} role="group" aria-label="Wheels">
          {wheelFinishOptions.map((w) => (
            <button key={w.id} type="button" className={s.chip} aria-pressed={state.wheel === w.id} onClick={() => patch({ wheel: w.id })}>
              {w.name}
            </button>
          ))}
        </div>
        <div className={s.group} role="group" aria-label="Environment">
          {environmentOptions.map((e) => (
            <button key={e.id} type="button" className={s.chip} aria-pressed={state.env === e.id} onClick={() => patch({ env: e.id })}>
              {e.name}
            </button>
          ))}
          <button type="button" className={s.chip} aria-pressed={state.lights} onClick={() => patch({ lights: !state.lights })}>
            <Light width={14} height={14} /> Lights
          </button>
        </div>
      </div>

      <div className={s.side} data-cursor="">
        {(["front", "side", "rear", "top"] as const).map((v) => (
          <button key={v} type="button" className={s.view} aria-pressed={state.view === v} onClick={() => patch({ view: v })}>
            {v}
          </button>
        ))}
        <span className={s.sep} />
        <button type="button" className={s.view} aria-label="Zoom in" onClick={() => patch({ zoom: ++zoomTick.current })}>
          <Plus width={16} height={16} />
        </button>
        <button type="button" className={s.view} aria-label="Zoom out" onClick={() => patch({ zoom: -++zoomTick.current })}>
          <span aria-hidden="true">−</span>
        </button>
      </div>

      <p className={s.hint} aria-hidden="true">
        <Rotate width={14} height={14} /> Drag to orbit
      </p>
    </div>
  );
}
