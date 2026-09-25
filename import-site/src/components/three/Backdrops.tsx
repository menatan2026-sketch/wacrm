"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GroundedSkybox } from "three/examples/jsm/objects/GroundedSkybox.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { UltraHDRLoader } from "three/examples/jsm/loaders/UltraHDRLoader.js";
import { BACKDROP_IDS, backdrops, type BackdropDef, type BackdropId, type SetId } from "@/config/environments";

/* ── Loading (module-level cache, shared by every canvas) ─────────── */

interface LoadedBackdrop {
  texture: THREE.DataTexture;
  /** Direction toward the brightest region, in skybox-local space. */
  sunLocal: THREE.Vector3;
}

const cache = new Map<BackdropId, Promise<LoadedBackdrop>>();

function brightestDirection(tex: THREE.DataTexture): THREE.Vector3 {
  const { data, width, height } = tex.image as { data: ArrayLike<number>; width: number; height: number };
  const half = tex.type === THREE.HalfFloatType;
  const read = (i: number) => (half ? THREE.DataUtils.fromHalfFloat(data[i] as number) : (data[i] as number));
  let best = -1;
  let bx = 0;
  let by = 0;
  const step = Math.max(1, Math.floor(width / 256));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const l = read(i) * 0.2126 + read(i + 1) * 0.7152 + read(i + 2) * 0.0722;
      if (l > best) {
        best = l;
        bx = x;
        by = y;
      }
    }
  }
  // Texel → uv as sampled by the sphere, → direction on SphereGeometry
  // (GroundedSkybox mirrors z so the inside reads correctly).
  const u = bx / width;
  const v = tex.flipY ? 1 - by / height : by / height;
  const phi = u * Math.PI * 2;
  const theta = (1 - v) * Math.PI;
  const dir = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), -Math.sin(phi) * Math.sin(theta));
  // Keep the key light above the horizon so it always casts a readable shadow.
  dir.y = Math.max(dir.y, 0.35);
  return dir.normalize();
}

/**
 * A photographed sun can be brighter than half-float can hold (65 504).
 * Inf/NaN texels would then poison the reflection cube and the bloom
 * mip chain (one bad pixel blacks out the whole frame), so clamp the
 * panorama to a still-dazzling ceiling. Run after the sun is located.
 */
const MAX_RADIANCE = 2048;
function clampRadiance(tex: THREE.DataTexture, ceiling = MAX_RADIANCE) {
  const data = (tex.image as { data: ArrayLike<number> & { [i: number]: number } }).data;
  if (tex.type === THREE.HalfFloatType) {
    const max = THREE.DataUtils.toHalfFloat(ceiling);
    for (let i = 0; i < data.length; i++) {
      const h = data[i];
      // Positive halves order like their bit patterns; NaN/Inf/huge → max,
      // negatives (never valid radiance) → 0.
      if (h & 0x8000) data[i] = 0;
      else if (h > max) data[i] = max;
    }
  } else {
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      data[i] = v > ceiling || v !== v ? ceiling : v < 0 ? 0 : v;
    }
  }
}

export function loadBackdrop(id: BackdropId): Promise<LoadedBackdrop> {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = backdrops[id];
  const loader = def.format === "hdr" ? new HDRLoader().setDataType(THREE.HalfFloatType) : new UltraHDRLoader().setDataType(THREE.HalfFloatType);
  const p = loader.loadAsync(def.url).then((texture) => {
    const t = texture as THREE.DataTexture;
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    // Half-float mip generation isn't renderable on every GPU (it comes
    // back black at grazing angles), so sample the base level only.
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    const sunLocal = brightestDirection(t);
    clampRadiance(t, def.maxRadiance);
    t.needsUpdate = true;
    return { texture: t, sunLocal };
  });
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}

/** Loads the first backdrop now and the rest when the browser is idle. */
export function useBackdropTextures(first: BackdropId[], later: BackdropId[] = []) {
  const [loaded, setLoaded] = useState<Partial<Record<BackdropId, LoadedBackdrop>>>({});
  const key = first.join() + "|" + later.join();
  useEffect(() => {
    let alive = true;
    const take = (id: BackdropId) =>
      loadBackdrop(id)
        .then((b) => alive && setLoaded((s) => ({ ...s, [id]: b })))
        .catch((e) => console.warn(`[backdrop] ${id} failed`, e));
    Promise.all(first.map(take)).then(() => {
      if (!alive) return;
      const idle = (cb: () => void) =>
        "requestIdleCallback" in window ? (window as Window & { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(cb) : setTimeout(cb, 600);
      idle(() => later.forEach(take));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key covers both lists
  }, [key]);
  return loaded;
}

/* ── Shared live state ────────────────────────────────────────────── */

export class BackdropState {
  /** Desired backdrop ("none" = procedural studio). */
  target: BackdropId | "none" = "studio";
  /** Global visibility (e.g. fades out while zooming to the globe). */
  visibility = 1;
  weights: Record<BackdropId, number> = { studio: 0, sunrise: 0, night: 0, city: 0 };
  /** Sum of weights × visibility — how "photographic" the scene is. */
  photo = 0;
  sunDir = new THREE.Vector3(-0.45, 0.75, 0.5).normalize();
  sunColor = new THREE.Color("#f3f1ec");
  sunIntensity = 1;
  shadowOpacity = 0.45;
  studioStrips = 1;
  /** Set when anything the env cube depends on changed. */
  envDirty = true;
}

const DEFAULT_SUN = new THREE.Vector3(-0.45, 0.75, 0.5).normalize();
const tmpDir = new THREE.Vector3();
const tmpCol = new THREE.Color();

/**
 * Advances weights toward the target and derives the light rig from the
 * dominant backdrop. Mount once per canvas.
 */
export function useBackdropDriver(state: BackdropState, loaded: Partial<Record<BackdropId, LoadedBackdrop>>, speed = 2.2) {
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const k = 1 - Math.exp(-dt * speed);
    let total = 0;
    let changed = false;
    // Until the requested panorama has loaded, hold the current one rather
    // than dropping to the procedural studio for a moment.
    let showing: BackdropId | "none" = state.target;
    if (showing !== "none" && !loaded[showing]) {
      showing = BACKDROP_IDS.reduce<BackdropId | "none">((best, id) => (state.weights[id] > (best === "none" ? 0 : state.weights[best]) ? id : best), "none");
    }
    for (const id of BACKDROP_IDS) {
      const want = showing === id ? 1 : 0;
      const w = state.weights[id] + (want - state.weights[id]) * k;
      if (Math.abs(w - state.weights[id]) > 1e-4) changed = true;
      state.weights[id] = w < 1e-3 ? 0 : w;
      total += state.weights[id];
    }
    const photo = total * state.visibility;
    if (Math.abs(photo - state.photo) > 1e-4) changed = true;
    state.photo = photo;

    // Light rig: blend each backdrop's sun with the studio key light.
    tmpDir.copy(DEFAULT_SUN).multiplyScalar(Math.max(0, 1 - photo));
    tmpCol.set("#f3f1ec").multiplyScalar(Math.max(0, 1 - photo));
    let intensity = 1.1 * Math.max(0, 1 - photo);
    let shadow = 0.45 * Math.max(0, 1 - photo);
    let strips = Math.max(0, 1 - photo);
    for (const id of BACKDROP_IDS) {
      const w = state.weights[id] * state.visibility;
      const b = loaded[id];
      if (!w || !b) continue;
      const def = backdrops[id];
      const dir = def.sunDir ? new THREE.Vector3(...def.sunDir).normalize() : b.sunLocal.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, def.rotationY);
      tmpDir.addScaledVector(dir, w);
      tmpCol.add(new THREE.Color(def.sun.color).multiplyScalar(w));
      intensity += def.sun.intensity * w;
      shadow += def.shadowOpacity * w;
      strips += def.studioStrips * w;
    }
    if (tmpDir.lengthSq() > 1e-6) state.sunDir.lerp(tmpDir.normalize(), k * 2).normalize();
    state.sunColor.copy(tmpCol);
    state.sunIntensity = intensity;
    state.shadowOpacity = shadow;
    state.studioStrips = strips;
    if (changed) state.envDirty = true;
  });
}

/** How present a built set is (0–1): the weight of every backdrop that uses it. */
export function setWeight(state: BackdropState, set: SetId) {
  let w = 0;
  for (const id of BACKDROP_IDS) if (backdrops[id].set === set) w += state.weights[id];
  return Math.min(1, w * state.visibility);
}

/* ── Visible grounded skyboxes ────────────────────────────────────── */

function Skybox({ def, loaded, state }: { def: BackdropDef; loaded: LoadedBackdrop; state: BackdropState }) {
  const mesh = useMemo(() => {
    const m = new GroundedSkybox(loaded.texture, def.groundHeight, def.groundRadius, 96);
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.transparent = true;
    mat.fog = false;
    mat.depthWrite = false;
    m.position.y = def.groundHeight - 0.01;
    m.rotation.y = def.rotationY;
    m.renderOrder = -9;
    m.frustumCulled = false;
    return m;
  }, [def, loaded]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  useFrame(() => {
    const o = def.hideSkybox ? 0 : state.weights[def.id] * state.visibility;
    mesh.visible = o > 0.002;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.min(1, o);
    mat.color.setScalar(def.background);
  });

  return <primitive object={mesh} />;
}

export function BackdropSkyboxes({ state, loaded }: { state: BackdropState; loaded: Partial<Record<BackdropId, LoadedBackdrop>> }) {
  return (
    <>
      {BACKDROP_IDS.map((id) => {
        const b = loaded[id];
        return b ? <Skybox key={id} def={backdrops[id]} loaded={b} state={state} /> : null;
      })}
    </>
  );
}

/* ── Env-cube spheres (rendered into the reflection environment) ──── */

function EnvSphere({ def, loaded, state }: { def: BackdropDef; loaded: LoadedBackdrop; state: BackdropState }) {
  const ref = useRef<THREE.Mesh>(null!);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: loaded.texture,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    [loaded],
  );
  useFrame(() => {
    const w = state.weights[def.id] * state.visibility;
    ref.current.visible = w > 0.002;
    material.color.setScalar(w * def.lighting);
  });
  return (
    <mesh ref={ref} material={material} rotation-y={def.rotationY} scale={[1, 1, -1]} renderOrder={-5}>
      <sphereGeometry args={[60, 64, 32]} />
    </mesh>
  );
}

export function BackdropEnvSpheres({ state, loaded }: { state: BackdropState; loaded: Partial<Record<BackdropId, LoadedBackdrop>> }) {
  return (
    <>
      {BACKDROP_IDS.map((id) => {
        const b = loaded[id];
        return b ? <EnvSphere key={id} def={backdrops[id]} loaded={b} state={state} /> : null;
      })}
    </>
  );
}

/* ── Sun + shadows ────────────────────────────────────────────────── */

/**
 * Directional key light aligned with the backdrop's sun, casting soft
 * shadows onto an invisible catcher at y = 0. The shadow map is only
 * re-rendered when the car or the light actually moves.
 */
export function SunAndShadows({
  state,
  anchor,
  enabled = true,
  mapSize = 2048,
  gain,
}: {
  state: BackdropState;
  /** Object the light follows (the car group). */
  anchor: React.RefObject<THREE.Object3D | null>;
  enabled?: boolean;
  mapSize?: number;
  /** Optional multiplier, e.g. the story's envGain. */
  gain?: React.RefObject<number>;
}) {
  const gl = useThree((s) => s.gl);
  const light = useRef<THREE.DirectionalLight>(null!);
  const catcher = useRef<THREE.Mesh>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  const last = useRef({ key: "" });

  useEffect(() => {
    gl.shadowMap.enabled = enabled;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl, enabled]);

  useFrame(() => {
    const l = light.current;
    const a = anchor.current;
    if (!l) return;
    const g = gain?.current ?? 1;
    const p = a ? a.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    target.position.copy(p);
    target.updateMatrixWorld();
    l.position.copy(p).addScaledVector(state.sunDir, 14);
    l.color.copy(state.sunColor);
    l.intensity = state.sunIntensity * g;
    if (catcher.current) {
      catcher.current.position.set(p.x, 0.002, p.z);
      (catcher.current.material as THREE.ShadowMaterial).opacity = state.shadowOpacity * Math.min(1, g);
      catcher.current.visible = enabled && g > 0.02;
    }
    // Re-render the shadow map only when something that affects it moved.
    const r = a ? a.rotation.y : 0;
    const key = `${p.x.toFixed(3)}|${p.z.toFixed(3)}|${r.toFixed(3)}|${state.sunDir.x.toFixed(3)}|${state.sunDir.y.toFixed(3)}|${state.sunDir.z.toFixed(3)}`;
    if (key !== last.current.key) {
      last.current.key = key;
      gl.shadowMap.needsUpdate = true;
    }
  });

  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        castShadow={enabled}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
        shadow-camera-near={2}
        shadow-camera-far={30}
      />
      <mesh ref={catcher} rotation-x={-Math.PI / 2} receiveShadow renderOrder={3}>
        <planeGeometry args={[14, 14]} />
        <shadowMaterial transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </>
  );
}
