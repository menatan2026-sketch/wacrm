"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  caliperOptions,
  environmentBackdrop,
  environmentOptions,
  getVehicleModel,
  interiorOptions,
  paintOptions,
  trimOptions,
  wheelFinishOptions,
  type EnvironmentId,
} from "@/config/vehicle-models";
import { Door, Hatch, Hood, Light, Plus, Rotate, Seat } from "@/components/ui/icons";
import { BackdropEnvSpheres, BackdropSkyboxes, BackdropState, setWeight, SunAndShadows, useBackdropDriver, useBackdropTextures } from "./Backdrops";
import { DynamicEnvironment, PaletteTarget } from "./DynamicEnvironment";
import { Effects } from "./Effects";
import { PortTerminal, Showroom, ShowroomEnvLights } from "./SceneSets";
import { Backdrop, FloorFade, FloorGlow, HeadlightGlow, setHeadlightGlow, type BackdropHandle } from "./StageFx";
import { createVehicleMaterials, updateVehicleMaterials } from "./vehicle-materials";
import { createVehicleHandles, poseOpenables, VehicleModel, type OpenableId, type VehicleHandles } from "./VehicleModel";
import s from "./VehicleViewer.module.css";

type View = "front" | "side" | "rear" | "top" | "free" | "cabin";
const VIEW_POS: Record<Exclude<View, "free" | "cabin">, [number, number, number]> = {
  front: [3.6, 1.2, 5.6],
  side: [7, 1.1, 0.01],
  rear: [-3.6, 1.4, -5.6],
  top: [0.01, 8.5, 0.6],
};
const ORBIT_TARGET = new THREE.Vector3(0, 0.55, 0);

interface ViewerState {
  paint: string;
  wheel: string;
  interior: string;
  trim: string;
  caliper: string;
  env: EnvironmentId;
  lights: boolean;
  doors: boolean;
  hood: boolean;
  hatch: boolean;
  view: View;
  zoom: number;
}

type Mode = "exterior" | "interior" | "open" | "scene";

const FOG_DAWN = new THREE.Color("#9d8b76");

function Scene({
  modelId,
  state,
  onReady,
  onToggle,
}: {
  modelId: string;
  state: ViewerState;
  onReady: () => void;
  onToggle: (id: OpenableId) => void;
}) {
  const model = getVehicleModel(modelId)!;
  const materials = useMemo(() => createVehicleMaterials(), []);
  const handles = useRef<VehicleHandles>(createVehicleHandles());
  const palette = useMemo(() => new PaletteTarget("studio"), []);
  const backdrop = useRef<BackdropHandle>(null!);
  const glow = useRef<THREE.Group>(null!);
  const controls = useRef<OrbitControlsImpl>(null!);
  const [envTex, setEnvTex] = useState<THREE.Texture | null>(null);
  const onTex = useCallback((t: THREE.Texture) => setEnvTex(t), []);
  const { camera, scene } = useThree();
  const flying = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const car = useRef<THREE.Group>(null!);
  const bd = useMemo(() => new BackdropState(), []);
  const loaded = useBackdropTextures([environmentBackdrop[state.env]], ["studio", "sunrise", "city", "night"]);
  const fog = useMemo(() => new THREE.Fog("#9d8b76", 55, 300), []);
  useBackdropDriver(bd, loaded);

  useEffect(() => {
    if (!envTex) return;
    for (const m of Object.values(materials)) {
      m.envMap = envTex;
      m.needsUpdate = true;
    }
  }, [envTex, materials]);

  useEffect(() => {
    if (state.view === "free") return;
    if (state.view === "cabin" && model.cabin) {
      flying.current = { pos: new THREE.Vector3(...model.cabin.eye), target: new THREE.Vector3(...model.cabin.target).lerp(new THREE.Vector3(...model.cabin.eye), 0.75) };
    } else if (state.view !== "cabin") {
      flying.current = { pos: new THREE.Vector3(...VIEW_POS[state.view]), target: ORBIT_TARGET.clone() };
    }
  }, [state.view, model]);

  useEffect(() => {
    // Zoom buttons dolly along the view ray.
    const c = controls.current;
    if (!c || state.view === "cabin") return;
    const dir = camera.position.clone().sub(c.target);
    const len = THREE.MathUtils.clamp(dir.length() * (state.zoom > 0 ? 0.85 : 1.18), 3.2, 12);
    flying.current = { pos: c.target.clone().add(dir.setLength(len)), target: c.target.clone() };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to explicit zoom presses only
  }, [state.zoom]);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 3);
    bd.target = environmentBackdrop[state.env];
    palette.set(state.env === "dusk" ? "dusk" : state.env === "night" ? "night" : "studio");
    for (const k2 of Object.keys(palette.intensity) as (keyof typeof palette.intensity)[]) palette.intensity[k2] *= bd.studioStrips;
    updateVehicleMaterials(materials, state, k);
    const on = state.lights ? 1 : 0;
    materials.headlights.emissiveIntensity += (on * 5 - materials.headlights.emissiveIntensity) * k;
    materials.taillights.emissiveIntensity += (on * 3 - materials.taillights.emissiveIntensity) * k;
    setHeadlightGlow(glow.current, (materials.headlights.emissiveIntensity / 5) * (1 - bd.photo * 0.7));
    poseOpenables(handles.current, { doorL: +state.doors, doorR: +state.doors, hood: +state.hood, hatch: +state.hatch }, Math.min(dt, 0.1));
    const bu = backdrop.current?.uniforms;
    if (bu) {
      bu.uGlowStrength.value = state.env === "studio" ? 0.4 : 0.25;
      bu.uHorizonStrength.value = state.env === "dusk" ? 1 : 0;
      bu.uGlow.value.set(state.env === "dusk" ? "#4a2a22" : state.env === "night" ? "#18213a" : "#454a53");
    }
    // Dawn haze over the port set only.
    const port = setWeight(bd, "port");
    scene.fog = port > 0.01 ? fog : null;
    fog.color.copy(FOG_DAWN);
    fog.near = THREE.MathUtils.lerp(400, 55, port);

    const c = controls.current;
    if (c) {
      const inCabin = state.view === "cabin";
      c.minDistance = inCabin ? 0.05 : 3.2;
      c.maxDistance = inCabin ? 1.2 : 12;
      c.minPolarAngle = inCabin ? 0.6 : 0.15;
      c.maxPolarAngle = inCabin ? 2.1 : Math.PI / 2 - 0.04;
      c.rotateSpeed = inCabin ? -0.35 : 0.6;
    }
    if (flying.current && c) {
      camera.position.lerp(flying.current.pos, k * 1.4);
      c.target.lerp(flying.current.target, k * 1.4);
      if (camera.position.distanceTo(flying.current.pos) < 0.01) flying.current = null;
      c.update();
    }
  });

  const [hx, hy, hz] = model.anchors.headlight;

  return (
    <>
      <DynamicEnvironment target={palette} onTexture={onTex} dirty={bd}>
        <BackdropEnvSpheres state={bd} loaded={loaded} />
        <ShowroomEnvLights state={bd} />
      </DynamicEnvironment>
      <Backdrop ref={backdrop} />
      <BackdropSkyboxes state={bd} loaded={loaded} />
      <Showroom state={bd} quality="medium" envTex={envTex} />
      <PortTerminal state={bd} envTex={envTex} />
      <SunAndShadows state={bd} anchor={car} />
      <group ref={car}>
        <Suspense fallback={null}>
          <VehicleModel model={model} materials={materials} handles={handles} onPartClick={onToggle} />
          <Ready onReady={onReady} />
        </Suspense>
      </group>
      <HeadlightGlow ref={glow} positions={[[hx, hy, hz], [-hx, hy, hz]]} />
      <ProceduralFloor state={bd} envTex={envTex} />
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

/** Dark studio floor, shown only while no photographic backdrop is up. */
function ProceduralFloor({ state, envTex }: { state: BackdropState; envTex: THREE.Texture | null }) {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    group.current.visible = state.photo < 0.98;
  });
  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.001}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#060607" roughness={0.4} metalness={0.5} envMap={envTex} envMapIntensity={0.06} />
      </mesh>
      <FloorGlow />
      <FloorFade />
    </group>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

/**
 * Interactive studio for any vehicle with a registered 3D model: orbit,
 * camera presets (including a seat in the cabin), paint, wheels,
 * calipers, the cabin's hide and trim, opening doors / bonnet / hatch,
 * environment and lights. Wheel-zoom is left to the page so scrolling
 * never gets trapped — the zoom buttons dolly the camera instead.
 */
export default function VehicleViewer({ modelId, initialPaint }: { modelId: string; initialPaint?: string }) {
  const model = getVehicleModel(modelId);
  const [state, setState] = useState<ViewerState>({
    paint: initialPaint ?? "graphite",
    wheel: "satin-black",
    interior: "cuoio",
    trim: "carbon",
    caliper: "graphite",
    env: "studio",
    lights: false,
    doors: false,
    hood: false,
    hatch: false,
    view: "front",
    zoom: 0,
  });
  const [mode, setMode] = useState<Mode>("exterior");
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const zoomTick = useRef(0);

  const patch = (p: Partial<ViewerState>) => setState((st) => ({ ...st, ...p }));
  const onToggle = useCallback((id: OpenableId) => {
    setState((st) => (id === "doorL" || id === "doorR" ? { ...st, doors: !st.doors } : { ...st, [id]: !st[id] }));
  }, []);
  const openable = new Set((model?.openables ?? []).map((o) => o.id));
  const hasInterior = Boolean(model?.materialSlots);
  const modes: { id: Mode; label: string }[] = [
    { id: "exterior", label: "Exterior" },
    ...(hasInterior ? [{ id: "interior" as const, label: "Interior" }] : []),
    ...(openable.size ? [{ id: "open" as const, label: "Open" }] : []),
    { id: "scene", label: "Scene" },
  ];

  return (
    <div className={s.viewer} data-ready={ready} data-cursor="drag">
      <Canvas
        className={s.canvas}
        shadows
        dpr={[1, 2]}
        camera={{ fov: 30, position: [3.6, 1.2, 5.6], near: 0.03, far: 300 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          scene.background = new THREE.Color("#030304");
        }}
      >
        <Scene modelId={modelId} state={state} onReady={onReady} onToggle={onToggle} />
        <Effects quality="medium" />
      </Canvas>

      {!ready && <div className={s.loading}>Preparing studio…</div>}

      <div className={s.controls} data-cursor="">
        <div className={s.modes} role="tablist" aria-label="Viewer sections">
          {modes.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={s.mode} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className={s.row}>
          {mode === "exterior" && (
            <>
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
              {hasInterior && (
                <div className={s.group} role="group" aria-label="Brake calipers">
                  {caliperOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={s.swatch}
                      style={{ "--c": o.color } as React.CSSProperties}
                      aria-pressed={state.caliper === o.id}
                      aria-label={`${o.name} calipers`}
                      title={`${o.name} calipers`}
                      onClick={() => patch({ caliper: o.id })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          {mode === "interior" && (
            <>
              <div className={s.group} role="group" aria-label="Leather">
                {interiorOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`${s.swatch} ${s.hide}`}
                    style={{ "--c": o.leather, "--c2": o.stitch } as React.CSSProperties}
                    aria-pressed={state.interior === o.id}
                    aria-label={`${o.name} leather`}
                    title={o.name}
                    onClick={() => patch({ interior: o.id })}
                  />
                ))}
              </div>
              <div className={s.group} role="group" aria-label="Trim">
                {trimOptions.map((o) => (
                  <button key={o.id} type="button" className={s.chip} aria-pressed={state.trim === o.id} onClick={() => patch({ trim: o.id })}>
                    {o.name}
                  </button>
                ))}
              </div>
              {model?.cabin && (
                <div className={s.group}>
                  <button type="button" className={s.chip} aria-pressed={state.view === "cabin"} onClick={() => patch({ view: state.view === "cabin" ? "front" : "cabin" })}>
                    <Seat width={14} height={14} /> {state.view === "cabin" ? "Step out" : "Take a seat"}
                  </button>
                </div>
              )}
            </>
          )}
          {mode === "open" && (
            <div className={s.group} role="group" aria-label="Open the car">
              {openable.has("doorL") && (
                <button type="button" className={s.chip} aria-pressed={state.doors} onClick={() => patch({ doors: !state.doors })}>
                  <Door width={14} height={14} /> Doors
                </button>
              )}
              {openable.has("hood") && (
                <button type="button" className={s.chip} aria-pressed={state.hood} onClick={() => patch({ hood: !state.hood })}>
                  <Hood width={14} height={14} /> Bonnet
                </button>
              )}
              {openable.has("hatch") && (
                <button type="button" className={s.chip} aria-pressed={state.hatch} onClick={() => patch({ hatch: !state.hatch, view: state.hatch ? state.view : "side" })}>
                  <Hatch width={14} height={14} /> Rear hatch
                </button>
              )}
            </div>
          )}
          {mode === "scene" && (
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
          )}
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
        <Rotate width={14} height={14} /> {openable.size ? "Drag to orbit · click to open" : "Drag to orbit"}
      </p>
    </div>
  );
}
