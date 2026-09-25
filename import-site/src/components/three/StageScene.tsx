"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { forwardRef, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { getVehicleModel, HERO_MODEL_ID } from "@/config/vehicle-models";
import { markets } from "@/data/markets";
import { sceneAnchors } from "./anchors";
import {
  BackdropEnvSpheres,
  BackdropSkyboxes,
  BackdropState,
  SunAndShadows,
  useBackdropDriver,
  setWeight,
  useBackdropTextures,
} from "./Backdrops";
import { director, getStageConfig, hudAnchors, setStageConfig } from "./director";
import { PortTerminal, Showroom, ShowroomEnvLights } from "./SceneSets";
import { DynamicEnvironment, PaletteTarget } from "./DynamicEnvironment";
import { Globe, GLOBE_ALIGN, latLngToVec3, type GlobeState } from "./Globe";
import { BASE_POSE, chapterPose, NUMERIC_KEYS, type Pose } from "./poses";
import {
  Backdrop,
  ContainerFrame,
  Dust,
  FloorFade,
  FloorGlow,
  HeadlightGlow,
  LightGate,
  Scanner,
  setHeadlightGlow,
  SpeedLines,
  type BackdropHandle,
  type DustHandle,
  type FloorFadeHandle,
  type LineFrameHandle,
} from "./StageFx";
import { createVehicleMaterials, updateVehicleMaterials } from "./vehicle-materials";
import { createVehicleHandles, poseOpenables, poseWheels, VehicleModel, type OpenableId, type VehicleHandles } from "./VehicleModel";

const K_MIN = 1 / 150;
const GLOBE_RADIUS_LOCAL = 2.5 / K_MIN;

/** Scalars that should track instantly (they encode discrete sweeps). */
const INSTANT = new Set<keyof Pose>(["scanner", "gate"]);
/** Scalars that settle a bit faster than the camera. */
const FAST = new Set<keyof Pose>(["container", "containerOpacity", "plate", "fade", "headlights", "taillights", "speed", "ring"]);

const FOG_DARK = new THREE.Color("#030304");
const FOG_DAWN = new THREE.Color("#9d8b76");
const tmpV = new THREE.Vector3();
const tmpT = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const camDir = new THREE.Vector3();

function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

export function StageScene({ onFade }: { onFade?: (v: number) => void }) {
  const { camera, size, scene } = useThree();
  const quality = director.quality;
  const model = getVehicleModel(HERO_MODEL_ID)!;

  const materials = useMemo(() => createVehicleMaterials(), []);
  const handles = useRef<VehicleHandles>(createVehicleHandles());
  const palette = useMemo(() => new PaletteTarget("studio"), []);
  const globeState = useMemo<GlobeState>(() => ({ opacity: 0, draw: 0, spin: 0, focus: null }), []);

  const world = useRef<THREE.Group>(null!);
  const car = useRef<THREE.Group>(null!);
  const floorMat = useRef<THREE.Material & { opacity: number }>(null!);
  const floor = useRef<THREE.Mesh>(null!);
  const backdrop = useRef<BackdropHandle>(null!);
  const dust = useRef<DustHandle>(null!);
  const speed = useRef<THREE.InstancedMesh>(null!);
  const container = useRef<LineFrameHandle>(null!);
  const gate = useRef<THREE.Group>(null!);
  const scanner = useRef<THREE.Mesh>(null!);
  const glow = useRef<THREE.Group>(null!);
  const spot = useRef<THREE.SpotLight>(null!);
  const backdrop3 = useMemo(() => new BackdropState(), []);
  const loadedBackdrops = useBackdropTextures(["studio"], quality === "low" ? ["sunrise"] : ["sunrise", "city", "night"]);
  const sunGain = useRef(1);
  const spotTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, 14);
    return o;
  }, []);
  const ring = useRef<THREE.Mesh>(null!);
  const road = useRef<THREE.Group>(null!);
  const floorFade = useRef<FloorFadeHandle>(null!);
  const floorGlow = useRef<THREE.Mesh>(null!);
  const fog = useMemo(() => new THREE.Fog("#030304", 18, 60), []);

  const [envTex, setEnvTex] = useState<THREE.Texture | null>(null);
  const onEnvTexture = useCallback((t: THREE.Texture) => setEnvTex(t), []);

  // Bind the env explicitly so each vehicle material's envMapIntensity is honoured.
  useEffect(() => {
    if (!envTex) return;
    for (const m of Object.values(materials)) {
      m.envMap = envTex;
      m.needsUpdate = true;
    }
  }, [envTex, materials]);

  const live = useRef<Pose>({ ...BASE_POSE, dist: 10.5, az: 1.15, envGain: 0 });
  const wheelSpin = useRef(0);
  const lastCarZ = useRef(0);
  const spinFocus = useRef(0);
  const time = useRef(0);

  useEffect(() => {
    scene.fog = fog;
    scene.background = new THREE.Color("#030304");
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  // Inspection anchors on the car for DOM overlays.
  useEffect(() => {
    const g = car.current;
    const objs = Object.entries(model.anchors).map(([k, p]) => {
      const o = new THREE.Object3D();
      o.position.set(...p);
      g.add(o);
      sceneAnchors.set(`car:${k}`, o);
      return [k, o] as const;
    });
    return () => {
      objs.forEach(([k, o]) => {
        g.remove(o);
        if (sceneAnchors.get(`car:${k}`) === o) sceneAnchors.delete(`car:${k}`);
      });
    };
  }, [model]);

  // Market azimuths in the globe's aligned frame, for focus rotation.
  const marketAngles = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of markets) {
      const v = latLngToVec3(m.lat, m.lng).applyQuaternion(GLOBE_ALIGN);
      out[m.code] = Math.atan2(v.x, v.z);
    }
    return out;
  }, []);

  // QA flag: ?snap settles every pose instantly (for screenshots on slow GPUs).
  const snap = useMemo(() => typeof window !== "undefined" && window.location.search.includes("snap"), []);
  useBackdropDriver(backdrop3, loadedBackdrops, snap ? 60 : 2.2);
  useEffect(() => {
    scene.userData.backdrop = backdrop3;
    // QA / deep links: ?cfg=doors:1,hood:1,view:cabin,interior:rosso
    const raw = new URLSearchParams(window.location.search).get("cfg");
    if (raw) {
      const patch: Record<string, string | boolean> = {};
      for (const pair of raw.split(",")) {
        const [k, v] = pair.split(":");
        if (k) patch[k] = v === "1" ? true : v === "0" ? false : v;
      }
      setStageConfig(patch as never);
    }
  }, [scene, backdrop3]);

  useFrame((state, rawDt) => {
    const dt = snap ? 1 : Math.min(rawDt, 1 / 20);
    time.current += dt;
    const cfg = getStageConfig();
    const tall = size.width / size.height < 0.85;
    const target = chapterPose(director.chapter, director.progress, {
      tall,
      env: cfg.env,
      lights: cfg.lights,
      view: cfg.view,
      anchors: model.anchors,
      cabin: model.cabin,
      yaw: live.current.carYaw + (director.chapter === "know" ? director.drag.yaw : 0),
    });

    // Intro: the car resolves out of darkness once the model is ready.
    const introT = director.loadedAt < 0 ? 0 : Math.min(1, (state.clock.elapsedTime - director.loadedAt) / 3.2);
    const intro = director.reducedMotion || snap ? (director.loadedAt >= 0 ? 1 : 0) : 1 - Math.pow(1 - introT, 3);
    if (director.chapter === "hero") {
      target.envGain *= intro;
      target.glow *= intro;
      target.dist += (1 - intro) * 2.4;
      target.az += (1 - intro) * 0.4;
    }

    // Idle life + pointer parallax (desktop, motion allowed).
    if (!director.reducedMotion) {
      const idle = director.chapter === "hero" || director.chapter === "drive" ? 1 : 0.35;
      target.az += Math.sin(time.current * 0.12) * 0.05 * idle + director.pointer.x * 0.05;
      target.el += director.pointer.y * 0.02;
    }

    const cur = live.current;
    const base = snap ? 60 : director.reducedMotion ? 9 : 2.6;
    for (const k of NUMERIC_KEYS) {
      if (INSTANT.has(k)) (cur[k] as number) = target[k] as number;
      else (cur[k] as number) = damp(cur[k] as number, target[k] as number, FAST.has(k) ? base * 2.2 : base, dt);
    }
    cur.palette = target.palette;
    cur.backdrop = target.backdrop;

    /* Camera */
    const persp = camera as THREE.PerspectiveCamera;
    tmpT.set(cur.tx, cur.ty, cur.tz);
    const cel = Math.cos(cur.el);
    tmpV.set(Math.sin(cur.az) * cel, Math.sin(cur.el), Math.cos(cur.az) * cel).multiplyScalar(cur.dist).add(tmpT);
    persp.position.copy(tmpV);
    persp.lookAt(tmpT);
    persp.fov = cur.fov;
    persp.setViewOffset(size.width, size.height, cur.shiftX * size.width * 0.5, cur.shiftY * size.height * 0.5, size.width, size.height);
    persp.near = 0.05;
    persp.far = 400;
    persp.updateProjectionMatrix();

    /* World zoom (studio ⇄ planet) */
    const z = Math.min(1, Math.max(0, cur.zoom));
    const k = Math.exp(Math.log(K_MIN) * z);
    world.current.scale.setScalar(k);
    globeState.opacity = THREE.MathUtils.smoothstep(z, 0.18, 0.55);
    globeState.draw = cur.globeDraw;

    const focus = director.chapter === "find" || director.chapter === "verify" ? cfg.market : null;
    globeState.focus = focus;
    let spinTarget = cur.globeSpin + (director.reducedMotion ? 0 : time.current * 0.02);
    if (focus && marketAngles[focus] !== undefined) {
      // Bring the focused market round toward the camera.
      const want = -marketAngles[focus] * 0.85;
      const base = spinTarget;
      const diff = Math.atan2(Math.sin(want - base), Math.cos(want - base));
      spinTarget = base + diff;
    }
    spinFocus.current = damp(spinFocus.current, spinTarget, 2, dt);
    globeState.spin = spinFocus.current;

    /* Photographic backdrop: fades out toward the globe and on the night road */
    backdrop3.target = cur.backdrop;
    backdrop3.visibility = (1 - z) * (1 - Math.min(1, cur.road));
    const photo = backdrop3.photo;

    /* Environment + backdrop */
    palette.set(cur.palette);
    for (const s of Object.keys(palette.intensity) as (keyof typeof palette.intensity)[]) {
      palette.intensity[s] *= cur.envGain * backdrop3.studioStrips;
    }
    const bu = backdrop.current?.uniforms;
    if (bu) {
      bu.uGlowStrength.value = cur.glow;
      bu.uHorizonStrength.value = cur.horizon;
      bu.uGlow.value.set(cur.palette === "dusk" ? "#4a2a22" : cur.palette === "transit" || cur.palette === "night" ? "#18213a" : "#454a53");
    }
    // Dawn haze over the port; the hall stays clean.
    const portW = setWeight(backdrop3, "port");
    fog.near = THREE.MathUtils.lerp(cur.fogNear, 55, portW);
    fog.far = THREE.MathUtils.lerp(cur.fogFar, 300, portW);
    fog.color.copy(FOG_DARK).lerp(FOG_DAWN, portW);

    /* Floor */
    const floorVis = cur.floor * (1 - z) * (1 - photo);
    if (floor.current) floor.current.visible = floorVis > 0.01;
    if (floorGlow.current) {
      floorGlow.current.visible = floorVis > 0.01;
      const gm = floorGlow.current.material as THREE.ShaderMaterial;
      gm.uniforms.uStrength.value = floorVis * cur.envGain * (1 - cur.road);
    }
    if (floorMat.current) floorMat.current.opacity = floorVis;

    /* Car */
    const carG = car.current;
    carG.position.z = cur.carZ;
    const dragYaw = director.chapter === "know" ? director.drag.yaw : director.drag.yaw * 0.0;
    carG.rotation.y = cur.carYaw + dragYaw;
    if (!director.drag.active) {
      director.drag.yaw += director.drag.velocity * dt;
      director.drag.velocity *= Math.exp(-dt * 2.5);
      if (director.chapter !== "know") director.drag.yaw = damp(director.drag.yaw, 0, 1.5, dt);
    }
    const dz = cur.carZ - lastCarZ.current;
    lastCarZ.current = cur.carZ;
    wheelSpin.current += dz / 0.34;
    poseWheels(handles.current, wheelSpin.current, cur.steer);

    // Hinged parts: the story's choreography, or the visitor's own choice
    // while the configurator is on screen.
    const own = director.chapter === "know";
    poseOpenables(
      handles.current,
      {
        doorL: Math.max(cur.doors, own && cfg.doors ? 1 : 0),
        doorR: Math.max(cur.doors, own && cfg.doors ? 1 : 0),
        hood: Math.max(cur.hood, own && cfg.hood ? 1 : 0),
        hatch: Math.max(cur.hatch, own && cfg.hatch ? 1 : 0),
      },
      snap ? 1 : Math.min(rawDt, 0.1),
      snap,
    );

    updateVehicleMaterials(materials, cfg, 1 - Math.exp(-dt * 4));
    materials.headlights.emissiveIntensity = cur.headlights * 5;
    materials.taillights.emissiveIntensity = cur.taillights * 3.5;
    // Beams read in the dark; in daylight only the lamps themselves glow.
    setHeadlightGlow(glow.current, cur.headlights * (1 - z) * (1 - 0.75 * photo * (cur.palette === "night" ? 0 : 1)));
    if (spot.current) spot.current.intensity = cur.headlights * 60 * (1 - z);
    // Key/sun light follows the backdrop; dimmed with the story's exposure.
    sunGain.current = Math.min(1.2, cur.envGain) * (1 - z) * (cur.palette === "night" && photo < 0.5 ? 0.35 : 1);

    const plate = handles.current.plate;
    if (plate) {
      plate.visible = cur.plate > 0.02;
      plate.scale.setScalar(0.6 + 0.4 * cur.plate);
      const pm = (plate as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (pm) pm.opacity = cur.plate;
    }

    /* Effects */
    if (dust.current) {
      dust.current.uniforms.uOpacity.value = cur.dust * (1 - z * 0.8);
      dust.current.uniforms.uFlow.value = cur.flow;
    }
    if (speed.current) (speed.current.material as THREE.MeshBasicMaterial).opacity = cur.speed * 0.55;
    container.current?.setProgress(cur.container);
    container.current?.setOpacity(cur.containerOpacity * 0.85);
    if (gate.current) {
      gate.current.visible = cur.gate >= 0 && cur.gate <= 1;
      gate.current.position.z = 4.2 - cur.gate * 8.4;
    }
    if (scanner.current) {
      const on = cur.scanner >= 0 && cur.scanner <= 1;
      scanner.current.visible = on;
      scanner.current.position.set(0, 0.8, 2.7 - cur.scanner * 5.4);
      const m = scanner.current.material as THREE.ShaderMaterial;
      m.uniforms.uOpacity.value = on ? Math.min(1, Math.sin(Math.PI * cur.scanner) * 2.5) : 0;
    }
    if (ring.current) {
      ring.current.visible = cur.ring > 0.01;
      (ring.current.material as THREE.MeshBasicMaterial).opacity = cur.ring * 0.5;
      ring.current.scale.setScalar(3.2 + Math.sin(time.current * 1.4) * 0.05);
    }
    if (road.current) {
      road.current.visible = cur.road > 0.01;
    }
    if (floorFade.current) {
      floorFade.current.uniforms.uInner.value = 3.5 + cur.road * 6;
      floorFade.current.uniforms.uOuter.value = 15 + cur.road * 30;
      floorFade.current.uniforms.uStrength.value = 1 - photo;
    }
    onFade?.(cur.fade);

    /* DOM overlays anchored to scene points */
    persp.getWorldDirection(camDir);
    hudAnchors.forEach(({ el, key }) => {
      const obj = sceneAnchors.get(key);
      if (!obj) return;
      obj.getWorldPosition(tmpV);
      let vis = 1;
      if (key.startsWith("market:")) {
        // Hide labels on the far side of the globe.
        obj.parent?.getWorldPosition(tmpN);
        tmpN.subVectors(tmpV, tmpN).normalize();
        const facing = -tmpN.dot(tmpT.subVectors(tmpV, persp.position).normalize());
        vis = THREE.MathUtils.smoothstep(facing, 0.05, 0.3) * globeState.opacity;
      }
      tmpV.project(persp);
      const x = (tmpV.x * 0.5 + 0.5) * size.width;
      const y = (-tmpV.y * 0.5 + 0.5) * size.height;
      if (tmpV.z > 1) vis = 0;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.setProperty("--x", x.toFixed(1));
      el.style.setProperty("--y", y.toFixed(1));
      el.style.setProperty("--vis", vis.toFixed(3));
    });
  });

  const headlightPositions = useMemo<[number, number, number][]>(() => {
    const [x, y, z] = model.anchors.headlight;
    return [
      [x, y, z],
      [-x, y, z],
    ];
  }, [model]);

  const reflector = quality === "high";

  // Clicking a door / hood / hatch in the configurator toggles it.
  const togglePart = useCallback((id: OpenableId) => {
    if (director.chapter !== "know") return;
    const c = getStageConfig();
    if (id === "doorL" || id === "doorR") setStageConfig({ doors: !c.doors });
    else setStageConfig({ [id]: !c[id] });
  }, []);
  const hoverPart = useCallback((id: OpenableId | null) => {
    const next = director.chapter === "know" ? id : null;
    if (director.hoverPart === next) return;
    director.hoverPart = next;
    if (next) document.body.dataset.hoverPart = next;
    else delete document.body.dataset.hoverPart;
  }, []);

  return (
    <>
      <DynamicEnvironment
        target={palette}
        resolution={quality === "low" ? 128 : 256}
        throttle={quality === "low" ? 3 : 1}
        onTexture={onEnvTexture}
        dirty={backdrop3}
      >
        <BackdropEnvSpheres state={backdrop3} loaded={loadedBackdrops} />
        <ShowroomEnvLights state={backdrop3} />
      </DynamicEnvironment>
      <Showroom state={backdrop3} quality={quality} envTex={envTex} />
      <PortTerminal state={backdrop3} envTex={envTex} />
      <Backdrop ref={backdrop} />
      <BackdropSkyboxes state={backdrop3} loaded={loadedBackdrops} />
      <SunAndShadows state={backdrop3} anchor={car} gain={sunGain} enabled={quality !== "low"} mapSize={quality === "high" ? 2048 : 1024} />

      <group ref={world}>
        <group ref={car}>
          <Suspense fallback={null}>
            <VehicleModel model={model} materials={materials} handles={handles} onPartClick={togglePart} onPartHover={hoverPart} />
            <LoadedSignal />
          </Suspense>
          <HeadlightGlow ref={glow} positions={headlightPositions} />
          <spotLight
            ref={spot}
            position={[0, 0.7, 2.2]}
            angle={0.55}
            penumbra={0.8}
            distance={26}
            decay={1.6}
            intensity={0}
            color="#eef3ff"
            target={spotTarget}
          />
          <primitive object={spotTarget} />
          <ContainerFrame ref={container} />
          <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.01} visible={false}>
            <ringGeometry args={[0.96, 1, 128]} />
            <meshBasicMaterial color="#e3c49a" transparent opacity={0} toneMapped={false} depthWrite={false} />
          </mesh>
        </group>
        <LightGate ref={gate} />
        <Scanner ref={scanner} />
        <Globe radius={GLOBE_RADIUS_LOCAL} state={globeState} lowDetail={quality === "low"} />
      </group>

      <mesh ref={floor} rotation-x={-Math.PI / 2} position-y={-0.001} renderOrder={-1}>
        <planeGeometry args={[220, 220]} />
        {reflector ? (
          <MeshReflectorMaterial
            ref={floorMat as never}
            blur={[400, 120]}
            resolution={size.width > 1400 ? 1024 : 768}
            mixBlur={1}
            mixStrength={28}
            roughness={0.92}
            depthScale={1.1}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.3}
            color="#060607"
            metalness={0.7}
            mirror={0}
            envMap={envTex}
            envMapIntensity={0.06}
            transparent
          />
        ) : (
          <meshStandardMaterial
            ref={floorMat as never}
            color="#060607"
            roughness={0.38}
            metalness={0.5}
            envMap={envTex}
            envMapIntensity={0.06}
            transparent
          />
        )}
      </mesh>

      <FloorGlow ref={floorGlow} />
      <FloorFade ref={floorFade} />
      <Road ref={road} />
      <Dust ref={dust} count={quality === "high" ? 1400 : quality === "medium" ? 800 : 420} />
      <SpeedLines ref={speed} count={quality === "low" ? 70 : 150} />
    </>
  );
}

function LoadedSignal() {
  const clock = useThree((s) => s.clock);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    director.loadedAt = clock.elapsedTime;
    document.documentElement.dataset.stage = "ready";
    if (window.location.search.includes("debug")) Object.assign(window, { __scene: scene, __camera: camera, __THREE: THREE, __stage: setStageConfig });
  }, [clock, scene, camera]);
  return null;
}


/** Lane markings for the final approach. */
const Road = forwardRef<THREE.Group>(function Road(_, ref) {
  const dashes = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let z = -80; z < 12; z += 6) out.push([0, 0.004, z]);
    return out;
  }, []);
  return (
    <group ref={ref} visible={false}>
      {dashes.map((p, i) => (
        <mesh key={i} position={p} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.12, 2.6]} />
          <meshBasicMaterial color="#6d6f73" toneMapped={false} />
        </mesh>
      ))}
      {[-3.4, 3.4].map((x) => (
        <mesh key={x} position={[x, 0.004, -34]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.1, 92]} />
          <meshBasicMaterial color="#5a5c60" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
});
