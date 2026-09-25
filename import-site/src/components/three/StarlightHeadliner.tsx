"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { VehicleModelDefinition } from "@/config/vehicle-models";
import { alcantaraMaps } from "./textures";

/**
 * Starlight headliner: a hand-stitched-looking black headliner pierced by
 * fibre-optic "stars" — mostly fine pinpoints, a few brighter ones, a
 * denser Milky-Way band — each twinkling on its own phase, with an
 * occasional shooting star streaking across. Stars are emissive and
 * unaffected by tone mapping, so the brightest bloom softly.
 *
 * Model-agnostic: the registry gives the headliner's centre, size and
 * sag (car space); `intensity` (0–1) fades the whole sky in and out.
 */

type Def = NonNullable<VehicleModelDefinition["starlight"]>;

export interface StarlightHandle {
  /** 0 = off, 1 = full sky; the scene eases it. */
  intensity: { value: number };
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = -mv.z;
    // Fibre-optic twinkle: slow swell plus a faster shimmer.
    float tw = 0.62 + 0.28 * sin(uTime * (0.35 + aPhase * 0.9) + aPhase * 37.0)
                    + 0.10 * sin(uTime * (2.1 + aPhase * 3.0) + aPhase * 91.0);
    // Real stars are sub-pixel from outside the car: fade with distance.
    vGlow = tw * uIntensity * clamp(0.9 / d, 0.08, 1.0);
    vColor = aColor;
    gl_PointSize = clamp(aSize * uPixelRatio * (0.55 / d), 1.0, 7.0 * uPixelRatio);
  }`;

const starFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, r);
    float a = core * core;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * vGlow * a * 2.6, 1.0);
  }`;

const streakVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/** One shooting star every ~7 s, on a pseudo-random path per cycle. */
const streakFragment = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec2 uAspect;
  varying vec2 vUv;
  float h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
  void main() {
    float period = 7.0;
    float cyc = floor(uTime / period);
    float t = (uTime - cyc * period) / 1.1; // streak lasts 1.1 s
    if (t > 1.0) discard;
    vec2 a = vec2(0.1 + 0.3 * h(cyc), 0.15 + 0.7 * h(cyc + 3.1));
    vec2 b = vec2(0.6 + 0.3 * h(cyc + 7.7), 0.15 + 0.7 * h(cyc + 9.3));
    vec2 head = mix(a, b, t);
    vec2 tail = mix(a, b, max(0.0, t - 0.28));
    vec2 p = vUv * uAspect;
    vec2 hp = head * uAspect;
    vec2 tp = tail * uAspect;
    vec2 ab = hp - tp;
    float k = clamp(dot(p - tp, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
    float dist = length(p - (tp + ab * k));
    float line = smoothstep(0.012, 0.0, dist) * k * k;
    float fade = sin(3.14159 * t);
    float glow = line * fade * uIntensity;
    if (glow < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * glow * 3.0, 1.0);
  }`;

export function StarlightHeadliner({ def, handle }: { def: Def; handle?: (h: StarlightHandle | null) => void }) {
  const [w, d] = def.size;

  // Curved headliner surface (faces down into the cabin).
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, d, 32, 32);
    g.rotateX(Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / (w / 2);
      const z = pos.getZ(i) / (d / 2);
      pos.setY(i, -def.sag * (x * x + 0.35 * z * z));
    }
    g.computeVertexNormals();
    return g;
  }, [w, d, def.sag]);

  const shared = useMemo(() => ({ uTime: { value: 0 }, uIntensity: { value: 1 }, uPixelRatio: { value: 1 } }), []);

  const headliner = useMemo(() => {
    const alc = alcantaraMaps();
    return new THREE.MeshPhysicalMaterial({
      color: "#07080b",
      roughness: 0.95,
      normalMap: alc?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.4, 0.4),
      sheen: 1,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color("#1c1e26"),
      envMapIntensity: 0.15,
      side: THREE.DoubleSide,
    });
  }, []);

  const stars = useMemo(() => {
    const rand = rng(1337);
    const count = def.count;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const color = new Float32Array(count * 3);
    const warm = new THREE.Color("#fff1dc");
    const cool = new THREE.Color("#dfe8ff");
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      let x: number;
      let z: number;
      // ~35% of stars crowd a diagonal Milky-Way band.
      if (rand() < 0.35) {
        const t = rand() * 2 - 1;
        const off = (rand() + rand() + rand() - 1.5) * 0.16;
        x = t * 0.95;
        z = t * 0.55 + off;
      } else {
        x = rand() * 2 - 1;
        z = rand() * 2 - 1;
      }
      x = THREE.MathUtils.clamp(x, -0.97, 0.97);
      z = THREE.MathUtils.clamp(z, -0.97, 0.97);
      const y = -def.sag * (x * x + 0.35 * z * z) - 0.0015;
      pos.set([(x * w) / 2, y, (z * d) / 2], i * 3);
      // Mostly pinpoints; a few brighter "hero" stars.
      const r = rand();
      size[i] = r > 0.985 ? 5.5 : r > 0.93 ? 3.2 : 1.4 + rand() * 1.2;
      phase[i] = rand();
      c.copy(warm).lerp(cool, rand());
      color.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
    const m = new THREE.ShaderMaterial({
      uniforms: shared,
      vertexShader: starVertex,
      fragmentShader: starFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { g, m };
  }, [def.count, def.sag, w, d, shared]);

  const streak = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: shared.uTime, uIntensity: shared.uIntensity, uAspect: { value: new THREE.Vector2(w / Math.max(w, d), d / Math.max(w, d)) } },
        vertexShader: streakVertex,
        fragmentShader: streakFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [shared, w, d],
  );

  useLayoutEffect(() => {
    handle?.({ intensity: shared.uIntensity });
    return () => handle?.(null);
  }, [handle, shared]);

  useFrame((state, dt) => {
    shared.uTime.value += Math.min(dt, 0.1);
    shared.uPixelRatio.value = state.gl.getPixelRatio();
  });

  return (
    <group position={def.center}>
      <mesh geometry={geometry} material={headliner} receiveShadow />
      <points geometry={stars.g} material={stars.m} renderOrder={4} frustumCulled={false} />
      <mesh geometry={geometry} material={streak} position-y={-0.002} renderOrder={4} />
    </group>
  );
}
