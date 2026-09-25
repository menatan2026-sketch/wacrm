"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { QualityTier } from "./director";
import { setWeight, type BackdropState } from "./Backdrops";
import { asphaltMaps, bayMarkings, concreteMaps, containerMaps, flutedNormal, letteringTexture } from "./textures";

/**
 * Built 3D sets. Each fades with the weight of the backdrop that uses it
 * (stochastic alpha — no sorting problems with the car's glass), and its
 * light sources are mirrored into the reflection cube by the matching
 * `*EnvLights` component, so paint and glass reflect the room they are in.
 *
 *  - Showroom: the delivery hall. Polished concrete with saw-cut joints,
 *    a lathe-finished turntable (a live mirror on the high tier) with an
 *    LED halo, fluted charcoal walls with light blades, a ceiling softbox
 *    and brushed-metal lettering.
 *  - Port: arrival at dawn. Asphalt with a painted delivery bay, stacks
 *    of corrugated containers, ship-to-shore cranes and light masts; the
 *    photographed sky stays behind it.
 */

const R = 13; // hall half-width (m)
const H = 7.4; // hall height
const FLOOR = -0.06; // floor sits below the turntable top (y = 0)

function fadeable<T extends THREE.Material>(m: T): T {
  m.alphaHash = true;
  return m;
}

function useFade(group: React.RefObject<THREE.Group | null>, mats: THREE.Material[], weight: () => number) {
  const last = useRef(-1);
  useFrame(() => {
    const w = weight();
    if (group.current) group.current.visible = w > 0.01;
    if (Math.abs(w - last.current) < 0.002) return;
    last.current = w;
    // Stochastic alpha only while fading: at full weight the hash would
    // still drop the odd pixel (speckles), so the set turns fully opaque.
    const hash = w < 0.995;
    for (const m of mats) {
      m.opacity = w;
      if (m.alphaHash !== hash) {
        m.alphaHash = hash;
        m.needsUpdate = true;
      }
    }
  });
}

function useBindEnv(mats: THREE.MeshStandardMaterial[], envTex: THREE.Texture | null) {
  useMemo(() => {
    if (!envTex) return;
    for (const m of mats) {
      m.envMap = envTex;
      m.needsUpdate = true;
    }
  }, [mats, envTex]);
}

/* ── Showroom ───────────────────────────────────────────────────── */

export function Showroom({ state, quality, envTex }: { state: BackdropState; quality: QualityTier; envTex: THREE.Texture | null }) {
  const group = useRef<THREE.Group>(null);
  const m = useMemo(() => {
    const concrete = concreteMaps();
    const floor = fadeable(
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        map: concrete?.map ?? null,
        roughnessMap: concrete?.roughnessMap ?? null,
        normalMap: concrete?.normalMap ?? null,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 1,
        metalness: 0,
        clearcoat: 0.35,
        clearcoatRoughness: 0.25,
        envMapIntensity: 0.25,
      }),
    );
    for (const t of [floor.map, floor.roughnessMap, floor.normalMap]) t?.repeat.set(10, 10);
    const fl = flutedNormal();
    const fluted = fl?.clone() ?? null;
    if (fluted) {
      fluted.repeat.set(220, 1);
      fluted.needsUpdate = true;
    }
    const wall = fadeable(new THREE.MeshPhysicalMaterial({ color: "#1b1c1f", roughness: 0.62, metalness: 0.1, normalMap: fluted, normalScale: new THREE.Vector2(1.2, 1.2), envMapIntensity: 0.4 }));
    const ceiling = fadeable(new THREE.MeshStandardMaterial({ color: "#0c0c0e", roughness: 0.9, envMapIntensity: 0.2 }));
    const blade = fadeable(new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff1dc").multiplyScalar(2.2), toneMapped: false }));
    const softbox = fadeable(new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(1.6), toneMapped: false }));
    const frame = fadeable(new THREE.MeshStandardMaterial({ color: "#101113", metalness: 0.8, roughness: 0.4 }));
    const edge = fadeable(new THREE.MeshPhysicalMaterial({ color: "#aeb1b6", metalness: 1, roughness: 0.28, envMapIntensity: 0.9 }));
    const resin = fadeable(
      new THREE.MeshPhysicalMaterial({ color: "#060607", roughness: 0.5, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.35, envMapIntensity: 0.12 }),
    );
    const halo = fadeable(new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd6a0").multiplyScalar(2.5), toneMapped: false }));
    const cove = fadeable(new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe2bd").multiplyScalar(1.2), toneMapped: false }));
    const letters = fadeable(
      new THREE.MeshPhysicalMaterial({ color: "#c9ccd1", metalness: 1, roughness: 0.3, alphaMap: letteringTexture("PORTOLAN"), alphaTest: 0.5, envMapIntensity: 1 }),
    );
    return { floor, wall, ceiling, blade, softbox, frame, edge, resin, halo, cove, letters };
  }, []);
  const all = useMemo(() => Object.values(m) as THREE.Material[], [m]);
  useBindEnv(useMemo(() => [m.floor, m.wall, m.ceiling, m.frame, m.edge, m.resin, m.letters], [m]), envTex);
  useFade(group, all, () => setWeight(state, "showroom"));

  // Vertical light blades on the four walls, skipping the lettering bay.
  const blades = useMemo(() => {
    const out: { p: [number, number, number]; r: number }[] = [];
    for (let i = -4; i <= 4; i++) {
      const t = i * 2.8;
      if (Math.abs(t) > 1.5) out.push({ p: [t, 3.2, -R + 0.08], r: 0 });
      out.push({ p: [t, 3.2, R - 0.08], r: Math.PI });
      out.push({ p: [-R + 0.08, 3.2, t], r: Math.PI / 2 });
      out.push({ p: [R - 0.08, 3.2, t], r: -Math.PI / 2 });
    }
    return out;
  }, []);

  const mirror = quality === "high";

  return (
    <group ref={group}>
      {/* Turntable: lathe-finished resin top (a mirror on high), alloy edge, LED halo. */}
      <mesh position-y={(FLOOR - 0.001) / 2} material={m.edge}>
        <cylinderGeometry args={[3.3, 3.3, -FLOOR - 0.001, 96, 1, true]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.0008}>
        <circleGeometry args={[3.3, 96]} />
        {mirror ? (
          <MeshReflectorMaterial
            alphaHash
            blur={[260, 90]}
            resolution={1024}
            mixBlur={1}
            mixStrength={3.2}
            mixContrast={1.1}
            roughness={0.55}
            depthScale={0.8}
            minDepthThreshold={0.3}
            maxDepthThreshold={1.2}
            color="#050506"
            metalness={0.5}
            mirror={0}
            envMap={envTex ?? undefined}
            envMapIntensity={0.12}
            ref={(mat: THREE.Material | null) => {
              if (mat && !all.includes(mat)) all.push(mat);
            }}
          />
        ) : (
          <primitive object={m.resin} attach="material" />
        )}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={FLOOR + 0.003} material={m.halo}>
        <ringGeometry args={[3.31, 3.36, 128]} />
      </mesh>

      {/* Floor, walls, ceiling. */}
      <mesh rotation-x={-Math.PI / 2} position-y={FLOOR} material={m.floor} receiveShadow>
        <planeGeometry args={[R * 2, R * 2]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation-y={(i * Math.PI) / 2} position={[Math.sin((i * Math.PI) / 2) * -R, FLOOR + H / 2, Math.cos((i * Math.PI) / 2) * -R]} material={m.wall}>
          <planeGeometry args={[R * 2, H]} />
        </mesh>
      ))}
      <mesh rotation-x={Math.PI / 2} position-y={FLOOR + H} material={m.ceiling}>
        <planeGeometry args={[R * 2, R * 2]} />
      </mesh>

      {/* Ceiling softbox with its frame, and cove light along the walls' foot. */}
      <mesh rotation-x={Math.PI / 2} position-y={FLOOR + H - 0.04} material={m.softbox}>
        <planeGeometry args={[4.6, 8.4]} />
      </mesh>
      <mesh position-y={FLOOR + H - 0.1} material={m.frame}>
        <boxGeometry args={[4.9, 0.12, 8.7]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`c${i}`} rotation-y={(i * Math.PI) / 2} position={[Math.sin((i * Math.PI) / 2) * -(R - 0.05), FLOOR + 0.05, Math.cos((i * Math.PI) / 2) * -(R - 0.05)]} material={m.cove}>
          <planeGeometry args={[R * 2, 0.03]} />
        </mesh>
      ))}

      {blades.map((b, i) => (
        <mesh key={`b${i}`} position={b.p} rotation-y={b.r} material={m.blade}>
          <planeGeometry args={[0.07, 5.6]} />
        </mesh>
      ))}

      {/* Brushed-metal lettering on the back wall. */}
      <mesh position={[0, 4.4, -R + 0.06]} material={m.letters}>
        <planeGeometry args={[6.4, 0.8]} />
      </mesh>
    </group>
  );
}

/** The hall's light sources, rendered into the reflection cube. */
export function ShowroomEnvLights({ state }: { state: BackdropState }) {
  const group = useRef<THREE.Group>(null);
  const m = useMemo(
    () => ({
      soft: new THREE.MeshBasicMaterial({ color: "#ffffff", blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      blade: new THREE.MeshBasicMaterial({ color: "#fff1dc", blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      floor: new THREE.MeshBasicMaterial({ color: "#ffffff", blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    }),
    [],
  );
  const last = useRef(-1);
  useFrame(() => {
    const w = setWeight(state, "showroom");
    if (group.current) group.current.visible = w > 0.01;
    if (Math.abs(w - last.current) < 0.002) return;
    last.current = w;
    m.soft.color.setScalar(9 * w);
    m.blade.color.set("#fff1dc").multiplyScalar(3.2 * w);
    m.floor.color.setScalar(0.05 * w);
    state.envDirty = true;
  });
  const blades = useMemo(() => {
    const out: [number, number, number, number][] = [];
    for (let i = -4; i <= 4; i++) {
      const t = i * 2.8;
      out.push([t, 3.2, -R, 0], [t, 3.2, R, Math.PI], [-R, 3.2, t, Math.PI / 2], [R, 3.2, t, -Math.PI / 2]);
    }
    return out;
  }, []);
  return (
    <group ref={group}>
      <mesh rotation-x={Math.PI / 2} position-y={H - 0.1} material={m.soft}>
        <planeGeometry args={[4.6, 8.4]} />
      </mesh>
      {blades.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} rotation-y={r} material={m.blade}>
          <planeGeometry args={[0.12, 5.6]} />
        </mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.1} material={m.floor}>
        <circleGeometry args={[R, 48]} />
      </mesh>
    </group>
  );
}

/* ── Port terminal ──────────────────────────────────────────────── */

const CONTAINER_COLOURS = ["#1f4f7a", "#8c2b1f", "#2f5d3a", "#c46a1c", "#6d6f72", "#a58c2a", "#3a3f6b", "#b3b0a7", "#7a2230", "#24606a"];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Real-size container box with UVs scaled so corrugation keeps its pitch. */
function containerGeometry(len: number) {
  const g = new THREE.BoxGeometry(len, 2.59, 2.44);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Box face order: +x, -x, +y, -y, +z, -z (4 verts each).
  const faceLen = [2.44, 2.44, len, len, len, len];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) uv.setX(f * 4 + v, uv.getX(f * 4 + v) * (faceLen[f] / 5));
  uv.needsUpdate = true;
  return g;
}

export function PortTerminal({ state, envTex }: { state: BackdropState; envTex: THREE.Texture | null }) {
  const group = useRef<THREE.Group>(null);
  const m = useMemo(() => {
    const a = asphaltMaps();
    const ground = fadeable(
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        map: a?.map ?? null,
        roughnessMap: a?.roughnessMap ?? null,
        normalMap: a?.normalMap ?? null,
        normalScale: new THREE.Vector2(0.8, 0.8),
        roughness: 1,
        envMapIntensity: 0.5,
      }),
    );
    for (const t of [ground.map, ground.roughnessMap, ground.normalMap]) t?.repeat.set(42, 42);
    const cm = containerMaps();
    const box = fadeable(new THREE.MeshStandardMaterial({ color: "#ffffff", map: cm?.map ?? null, normalMap: cm?.normalMap ?? null, normalScale: new THREE.Vector2(1.2, 1.2), metalness: 0.35, roughness: 0.62, envMapIntensity: 0.6 }));
    const bay = fadeable(new THREE.MeshStandardMaterial({ map: bayMarkings(), transparent: false, alphaTest: 0.05, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
    const crane = fadeable(new THREE.MeshStandardMaterial({ color: "#c9c6bf", metalness: 0.4, roughness: 0.55, envMapIntensity: 0.5 }));
    const craneRed = fadeable(new THREE.MeshStandardMaterial({ color: "#9b2a22", metalness: 0.4, roughness: 0.5 }));
    const pole = fadeable(new THREE.MeshStandardMaterial({ color: "#8d8f93", metalness: 0.8, roughness: 0.45 }));
    const lamp = fadeable(new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd49a").multiplyScalar(2.2), toneMapped: false }));
    const beacon = fadeable(new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff2a1a").multiplyScalar(3), toneMapped: false }));
    const barrier = fadeable(new THREE.MeshStandardMaterial({ color: "#a9a59c", roughness: 0.85, map: concreteMaps()?.map ?? null }));
    return { ground, box, bay, crane, craneRed, pole, lamp, beacon, barrier };
  }, []);
  const all = useMemo(() => Object.values(m) as THREE.Material[], [m]);
  useBindEnv(useMemo(() => [m.ground, m.box, m.crane, m.craneRed, m.pole, m.barrier], [m]), envTex);
  useFade(group, all, () => setWeight(state, "port"));

  // Container yard: stacks placed in blocks that frame the car, leaving a
  // view toward the cranes.
  const yard = useMemo(() => {
    const rand = rng(7);
    const long: THREE.Matrix4[] = [];
    const short: THREE.Matrix4[] = [];
    const colors40: THREE.Color[] = [];
    const colors20: THREE.Color[] = [];
    const q = new THREE.Quaternion();
    const place = (x: number, z: number, rotY: number, tiers: number, is40: boolean) => {
      for (let t = 0; t < tiers; t++) {
        const mtx = new THREE.Matrix4().compose(
          new THREE.Vector3(x + (rand() - 0.5) * 0.08, 1.295 + t * 2.59, z + (rand() - 0.5) * 0.08),
          q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY + (rand() - 0.5) * 0.01),
          new THREE.Vector3(1, 1, 1),
        );
        const c = new THREE.Color(CONTAINER_COLOURS[Math.floor(rand() * CONTAINER_COLOURS.length)]).multiplyScalar(0.8 + rand() * 0.3);
        (is40 ? long : short).push(mtx);
        (is40 ? colors40 : colors20).push(c);
      }
    };
    // Block behind (−z), rows of 40 ft boxes running along x, with an
    // aisle through the middle toward the quay cranes.
    for (let row = 0; row < 4; row++) {
      for (let k = -4; k <= 3; k++) {
        if (k === 0 || rand() < 0.18) continue;
        place(k * 12.6 + 6, -34 - row * 2.7, 0, 1 + Math.floor(rand() * 3), true);
      }
    }
    // Block to the car's right (+x), running along z.
    for (let row = 0; row < 3; row++) {
      for (let k = -2; k <= 2; k++) {
        if (rand() < 0.2) continue;
        place(30 + row * 2.7, k * 12.6 - 6, Math.PI / 2, 1 + Math.floor(rand() * 3), rand() > 0.3);
      }
    }
    // A few loose 20 ft boxes on the left and ahead, low.
    for (let i = 0; i < 16; i++) {
      const ang = Math.PI * 0.55 + rand() * Math.PI * 0.9;
      const r = 32 + rand() * 26;
      place(Math.cos(ang) * r, Math.sin(ang) * r, rand() * Math.PI, 1 + Math.floor(rand() * 2), false);
    }
    return { long, short, colors40, colors20 };
  }, []);

  const inst40 = useRef<THREE.InstancedMesh>(null);
  const inst20 = useRef<THREE.InstancedMesh>(null);
  const g40 = useMemo(() => containerGeometry(12.19), []);
  const g20 = useMemo(() => containerGeometry(6.06), []);
  useMemo(() => {
    // Filled once the instanced meshes exist (next frame).
    return null;
  }, []);
  const filled = useRef(false);
  useFrame(() => {
    if (filled.current || !inst40.current || !inst20.current) return;
    yard.long.forEach((mtx, i) => {
      inst40.current!.setMatrixAt(i, mtx);
      inst40.current!.setColorAt(i, yard.colors40[i]);
    });
    yard.short.forEach((mtx, i) => {
      inst20.current!.setMatrixAt(i, mtx);
      inst20.current!.setColorAt(i, yard.colors20[i]);
    });
    for (const im of [inst40.current, inst20.current]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
    }
    filled.current = true;
  });

  // Kept inside the 110 m sky dome (it draws over anything beyond).
  const cranes = useMemo(() => [-44, 2, 48].map((x, i) => ({ x, z: -58 - i * 4 })), []);
  const masts = useMemo<[number, number][]>(() => [[-18, 16], [20, 20], [-30, -18], [24, -26], [2, 40], [-44, 34]], []);

  return (
    <group ref={group}>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.002} material={m.ground} receiveShadow>
        <circleGeometry args={[106, 96]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI]} position-y={0.001} material={m.bay}>
        <planeGeometry args={[3.2, 6.4]} />
      </mesh>

      <instancedMesh ref={inst40} args={[g40, m.box, yard.long.length]} frustumCulled={false} />
      <instancedMesh ref={inst20} args={[g20, m.box, yard.short.length]} frustumCulled={false} />

      {/* Ship-to-shore cranes along the quay. */}
      {cranes.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]}>
          {[-9, 9].map((dx) =>
            [-7, 7].map((dz) => (
              <mesh key={`${dx}${dz}`} position={[dx, 24, dz]} material={m.crane}>
                <boxGeometry args={[1.4, 48, 1.4]} />
              </mesh>
            )),
          )}
          <mesh position={[0, 46, 0]} material={m.crane}>
            <boxGeometry args={[20, 2.6, 16]} />
          </mesh>
          <mesh position={[0, 50, -12]} material={m.craneRed}>
            <boxGeometry args={[4, 3, 60]} />
          </mesh>
          <mesh position={[0, 64, 4]} material={m.crane}>
            <boxGeometry args={[3, 30, 3]} />
          </mesh>
          <mesh position={[0, 79.5, 4]} material={m.beacon}>
            <sphereGeometry args={[0.6, 12, 8]} />
          </mesh>
        </group>
      ))}

      {/* Light masts with warm lamp heads. */}
      {masts.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={14} material={m.pole}>
            <cylinderGeometry args={[0.18, 0.32, 28, 12]} />
          </mesh>
          <mesh position-y={28.4} material={m.pole}>
            <boxGeometry args={[3.2, 0.3, 1.2]} />
          </mesh>
          <mesh position-y={28.2} rotation-x={Math.PI / 2} material={m.lamp}>
            <planeGeometry args={[3, 1]} />
          </mesh>
        </group>
      ))}

      {/* Jersey barriers marking the delivery lane (clear of the camera paths). */}
      {[-13, 13].map((x) =>
        [-14, -10, 10, 14].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.41, z]} material={m.barrier}>
            <boxGeometry args={[0.6, 0.82, 3.6]} />
          </mesh>
        )),
      )}
    </group>
  );
}
