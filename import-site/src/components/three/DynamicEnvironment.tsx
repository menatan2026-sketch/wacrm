"use client";

import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

/**
 * A procedural light-studio environment.
 *
 * Instead of an HDRI we render a handful of emissive "light formers"
 * (soft boxes, strips, a horizon band) into a cube map. That's what
 * paints the long, clean highlights across the car's clear coat — and
 * because it's procedural, the whole studio can shift from cold studio
 * white to dusk to night as the story scrolls. The cube is re-rendered
 * only while the palette is actually changing.
 */

export interface Palette {
  ceiling: [string, number];
  left: [string, number];
  right: [string, number];
  back: [string, number];
  front: [string, number];
  horizon: [string, number];
  floor: [string, number];
}

export type PaletteId = "studio" | "dusk" | "night" | "transit" | "inspect" | "void" | "dawn";

export const palettes: Record<PaletteId, Palette> = {
  studio: {
    ceiling: ["#ffffff", 14],
    left: ["#f4f6ff", 7],
    right: ["#ffffff", 5.5],
    back: ["#ffffff", 2],
    front: ["#ffffff", 5],
    horizon: ["#9aa4b8", 0.2],
    floor: ["#1a1c20", 0.25],
  },
  inspect: {
    ceiling: ["#eaf1ff", 16],
    left: ["#dfe8ff", 6],
    right: ["#dfe8ff", 6],
    back: ["#cfdcff", 3],
    front: ["#ffffff", 4.5],
    horizon: ["#8fb2ff", 0.8],
    floor: ["#1d2130", 0.3],
  },
  dusk: {
    ceiling: ["#ffb489", 1.2],
    left: ["#ff6a2b", 8],
    right: ["#6b4cff", 3],
    back: ["#ff9457", 5],
    front: ["#ffcfb0", 1.2],
    horizon: ["#ff7a3a", 9],
    floor: ["#2a130b", 0.35],
  },
  dawn: {
    ceiling: ["#ffe2c4", 4],
    left: ["#ffc58f", 6],
    right: ["#9fb4ff", 2.5],
    back: ["#ffd2a6", 4],
    front: ["#fff1e0", 2.5],
    horizon: ["#ffb070", 6],
    floor: ["#2a1d14", 0.3],
  },
  night: {
    ceiling: ["#9cb6ff", 1.4],
    left: ["#6f8dff", 1.6],
    right: ["#ffb469", 1.8],
    back: ["#3a58ff", 1.4],
    front: ["#c9d6ff", 0.9],
    horizon: ["#ff9b54", 2.4],
    floor: ["#080a12", 0.2],
  },
  transit: {
    ceiling: ["#7c9bff", 2.6],
    left: ["#5a7dff", 3.2],
    right: ["#94acff", 2.6],
    back: ["#3148a8", 1.8],
    front: ["#b8c8ff", 1.2],
    horizon: ["#4a6cff", 2.4],
    floor: ["#0a0e1f", 0.25],
  },
  void: {
    ceiling: ["#b7c3dc", 1.2],
    left: ["#8c9ab8", 0.7],
    right: ["#8c9ab8", 0.7],
    back: ["#4a5670", 0.6],
    front: ["#b7c3dc", 0.5],
    horizon: ["#445066", 0.3],
    floor: ["#050608", 0.1],
  },
};

type Slot = keyof Palette;
const SLOTS: Slot[] = ["ceiling", "left", "right", "back", "front", "horizon", "floor"];

/** Mutable palette target the rigs write into. */
export class PaletteTarget {
  colors: Record<Slot, THREE.Color>;
  intensity: Record<Slot, number>;
  constructor(initial: PaletteId = "studio") {
    this.colors = {} as Record<Slot, THREE.Color>;
    this.intensity = {} as Record<Slot, number>;
    this.set(initial);
  }
  set(id: PaletteId) {
    const p = palettes[id];
    for (const s of SLOTS) {
      this.colors[s] = (this.colors[s] ?? new THREE.Color()).set(p[s][0]);
      this.intensity[s] = p[s][1];
    }
  }
  /** Blend between two palettes, then scale everything by `gain`. */
  blend(a: PaletteId, b: PaletteId, t: number, gain = 1) {
    const pa = palettes[a];
    const pb = palettes[b];
    const cb = new THREE.Color();
    for (const s of SLOTS) {
      this.colors[s].set(pa[s][0]).lerp(cb.set(pb[s][0]), t);
      this.intensity[s] = (pa[s][1] + (pb[s][1] - pa[s][1]) * t) * gain;
    }
  }
}

// Formers are additive emitters, so they never occlude the HDRI behind them.
function formerMaterial(side: THREE.Side = THREE.DoubleSide) {
  return new THREE.MeshBasicMaterial({ side, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
}

function former(geo: THREE.BufferGeometry, pos: [number, number, number], rot: [number, number, number]) {
  const mesh = new THREE.Mesh(geo, formerMaterial());
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  return mesh;
}

export function DynamicEnvironment({
  target,
  resolution = 256,
  throttle = 1,
  onTexture,
  children,
  dirty,
}: {
  /** Extra objects rendered into the env cube (e.g. HDRI spheres). */
  children?: ReactNode;
  /** External "needs re-render" flag, cleared after each cube update. */
  dirty?: { envDirty: boolean };
  target: PaletteTarget;
  resolution?: number;
  /** Re-render at most every N frames while animating (mobile). */
  throttle?: number;
  /**
   * Receives the env texture. Materials that need a different reflection
   * strength must bind it as their own `envMap` — with `scene.environment`
   * three.js ignores `material.envMapIntensity`.
   */
  onTexture?: (t: THREE.Texture) => void;
}) {
  const { gl, scene } = useThree();
  const frame = useRef(0);

  const { fbo, cubeCamera, envScene, slots, current } = useMemo(() => {
    const fbo = new THREE.WebGLCubeRenderTarget(resolution, { type: THREE.HalfFloatType });
    const cubeCamera = new THREE.CubeCamera(0.1, 200, fbo);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color("#000000");

    const strip = new THREE.PlaneGeometry(1, 1);
    const slots: Record<Slot, THREE.Mesh[]> = {
      ceiling: [-6, -3, 0, 3, 6].map((z) => former(strip, [0, 7, z], [Math.PI / 2, 0, 0])),
      left: [former(strip, [-14, 2.2, 0], [0, Math.PI / 2, 0])],
      right: [former(strip, [14, 2.2, 0], [0, -Math.PI / 2, 0])],
      back: [former(strip, [0, 3, -16], [0, 0, 0])],
      front: [former(strip, [-6, 4, 14], [0, Math.PI - 0.4, 0])],
      horizon: [
        new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 1.6, 48, 1, true), formerMaterial(THREE.BackSide)),
      ],
      floor: [former(new THREE.CircleGeometry(40, 32), [0, -0.5, 0], [-Math.PI / 2, 0, 0])],
    };
    // Narrow, bright formers: crisp highlights in the clear coat without
    // flooding rough surfaces (which see the env's average, not its peaks).
    slots.ceiling.forEach((m) => m.scale.set(10, 0.45, 1));
    slots.left[0].scale.set(34, 1.3, 1);
    slots.right[0].scale.set(34, 1.3, 1);
    slots.back[0].scale.set(16, 2.4, 1);
    slots.front[0].scale.set(6, 2.2, 1);
    slots.horizon[0].position.y = 0.6;
    for (const s of SLOTS) slots[s].forEach((m) => envScene.add(m));

    const current = new PaletteTarget("void");
    return { fbo, cubeCamera, envScene, slots, current };
  }, [resolution]);

  useEffect(() => {
    const prev = scene.environment;
    scene.environment = fbo.texture;
    onTexture?.(fbo.texture);
    return () => {
      scene.environment = prev;
      fbo.dispose();
    };
  }, [scene, fbo, onTexture]);

  const needsFirst = useRef(true);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 3.2);
    let delta = 0;
    for (const s of SLOTS) {
      const c = current.colors[s];
      const tc = target.colors[s];
      delta += Math.abs(c.r - tc.r) + Math.abs(c.g - tc.g) + Math.abs(c.b - tc.b);
      c.lerp(tc, k);
      const di = target.intensity[s] - current.intensity[s];
      delta += Math.abs(di);
      current.intensity[s] += di * k;
    }
    frame.current++;
    const external = dirty?.envDirty ?? false;
    if (!needsFirst.current && ((delta < 0.004 && !external) || frame.current % throttle !== 0)) return;
    needsFirst.current = false;
    if (dirty) dirty.envDirty = false;
    for (const s of SLOTS) {
      for (const m of slots[s]) {
        (m.material as THREE.MeshBasicMaterial).color.copy(current.colors[s]).multiplyScalar(current.intensity[s]);
      }
    }
    cubeCamera.update(gl, envScene);
    fbo.texture.needsPMREMUpdate = true;
  });

  return children ? createPortal(children, envScene) : null;
}
