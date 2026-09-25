"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { VehicleModelDefinition } from "@/config/vehicle-models";
import { carbonMaps, engineMaps } from "./textures";
import type { VehicleMaterials } from "./vehicle-materials";

/**
 * A display engine for models whose bay is empty: a transverse
 * twin-turbo V8, built from primitives with real materials — sand-cast
 * block, crackle-finish cam covers (they follow the caliper colour),
 * carbon plenum and strut brace, heat-tinted titanium headers, polished
 * charge pipes, gold heat-shield foil and warm bay lighting. Sits behind
 * the rear seats, visible through the glass and when the hatch rises.
 *
 * Local frame: origin on the bay floor, +X across the car, +Z forward.
 */

type Bay = NonNullable<VehicleModelDefinition["engineBay"]>;
type Frunk = NonNullable<VehicleModelDefinition["frunk"]>;

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Heat tint along an exhaust tube: straw → gold → violet → blue. */
function heatColors(geo: THREE.TubeGeometry, segments: number, radial: number) {
  const stops = [new THREE.Color("#b9b3a8"), new THREE.Color("#c79a4c"), new THREE.Color("#7a3f6e"), new THREE.Color("#2f4f8a"), new THREE.Color("#6b6f78")];
  const colors = new Float32Array(geo.attributes.position.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const f = t * (stops.length - 1);
    const a = Math.min(stops.length - 2, Math.floor(f));
    c.copy(stops[a]).lerp(stops[a + 1], f - a);
    for (let j = 0; j <= radial; j++) {
      const k = (i * (radial + 1) + j) * 3;
      colors[k] = c.r;
      colors[k + 1] = c.g;
      colors[k + 2] = c.b;
    }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function useEngineMaterials() {
  return useMemo(() => {
    const maps = engineMaps();
    const carbon = carbonMaps();
    const cast = new THREE.MeshPhysicalMaterial({ color: "#a4a6aa", metalness: 0.75, roughness: 0.5, normalMap: maps?.cast ?? null, normalScale: new THREE.Vector2(0.8, 0.8) });
    const polished = new THREE.MeshPhysicalMaterial({ color: "#dfe2e6", metalness: 1, roughness: 0.12 });
    const carbonMat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      map: carbon?.map ?? null,
      normalMap: carbon?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.6, 0.6),
      metalness: 0.3,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    });
    if (carbonMat.map) {
      carbonMat.map = carbonMat.map.clone();
      carbonMat.map.repeat.set(3, 3);
      carbonMat.normalMap = carbonMat.normalMap!.clone();
      carbonMat.normalMap.repeat.set(3, 3);
    }
    const headers = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 1, roughness: 0.28, clearcoat: 0.4 });
    const foil = new THREE.MeshPhysicalMaterial({ color: "#d9a64a", metalness: 1, roughness: 0.3, normalMap: maps?.foil ?? null, normalScale: new THREE.Vector2(1, 1) });
    const blackAnod = new THREE.MeshPhysicalMaterial({ color: "#16171a", metalness: 0.8, roughness: 0.4 });
    const silicone = new THREE.MeshPhysicalMaterial({ color: "#121213", roughness: 0.7, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color("#2a2a2a") });
    const reservoir = new THREE.MeshPhysicalMaterial({ color: "#e8e4dc", roughness: 0.35, transmission: 0.4, thickness: 0.02, transparent: true, opacity: 0.9 });
    const led = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a8").multiplyScalar(3), toneMapped: false });
    const cap = new THREE.MeshPhysicalMaterial({ color: "#d4a300", roughness: 0.35, clearcoat: 1 });
    return { cast, polished, carbon: carbonMat, headers, foil, blackAnod, silicone, reservoir, led, cap, ribs: maps?.ribs ?? null };
  }, []);
}

function useSharedEnv(own: THREE.MeshPhysicalMaterial[], source: THREE.MeshPhysicalMaterial) {
  useFrame(() => {
    if (!source.envMap || own[0].envMap === source.envMap) return;
    for (const m of own) {
      m.envMap = source.envMap;
      m.needsUpdate = true;
    }
  });
}

export function EngineAssembly({ materials, bay }: { materials: VehicleMaterials; bay: Bay }) {
  const m = useEngineMaterials();
  // Cam covers wear the caliper colour, in a wrinkle finish.
  const camCover = useMemo(() => {
    const c = materials.caliper.clone();
    c.normalMap = m.ribs;
    c.normalScale = new THREE.Vector2(0.9, 0.9);
    c.roughness = 0.55;
    c.clearcoat = 0.3;
    return c;
  }, [materials.caliper, m.ribs]);
  useFrame(() => {
    camCover.color.copy(materials.caliper.color);
  });
  useSharedEnv([m.cast, m.polished, m.carbon, m.headers, m.foil, m.blackAnod, m.silicone, m.reservoir, m.cap, camCover], materials.mechanical);

  const geo = useMemo(() => {
    const headerTubes: THREE.TubeGeometry[] = [];
    // Four primaries per bank, sweeping from the heads down to a collector.
    for (const side of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const x = -0.24 + i * 0.16;
        const curve = new THREE.CatmullRomCurve3([
          V(x, 0.42, side * 0.19),
          V(x, 0.36, side * 0.27),
          V(x * 0.6 + side * 0.02, 0.2, side * 0.28),
          V(side * 0.36, 0.2, side * 0.18),
        ]);
        headerTubes.push(heatColors(new THREE.TubeGeometry(curve, 40, 0.017, 10, false), 40, 10));
      }
    }
    const charge = [1, -1].map(
      (s) =>
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3([V(s * 0.44, 0.36, 0), V(s * 0.46, 0.52, 0.04), V(s * 0.36, 0.62, 0.02), V(s * 0.28, 0.6, 0)]),
          32,
          0.03,
          14,
          false,
        ),
    );
    const tailpipes = [1, -1].map(
      (s) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(s * 0.4, 0.2, 0.05), V(s * 0.42, 0.22, -0.16), V(s * 0.4, 0.3, -0.26)]), 24, 0.04, 16, false),
    );
    return {
      headerTubes,
      charge,
      tailpipes,
      block: new RoundedBoxGeometry(0.66, 0.22, 0.3, 3, 0.03),
      head: new RoundedBoxGeometry(0.66, 0.1, 0.15, 3, 0.02),
      cover: new RoundedBoxGeometry(0.62, 0.05, 0.13, 4, 0.02),
      coil: new RoundedBoxGeometry(0.035, 0.05, 0.05, 2, 0.008),
      plenum: new RoundedBoxGeometry(0.58, 0.08, 0.17, 4, 0.035),
      brace: new RoundedBoxGeometry(1.5, 0.028, 0.06, 3, 0.012),
      turbo: new THREE.TorusGeometry(0.055, 0.03, 16, 40),
      turboCore: new THREE.CylinderGeometry(0.035, 0.035, 0.09, 24),
      throttle: new THREE.CylinderGeometry(0.045, 0.045, 0.07, 32),
      coupler: new THREE.CylinderGeometry(0.036, 0.036, 0.05, 24),
      reservoir: new RoundedBoxGeometry(0.12, 0.1, 0.09, 3, 0.02),
      capGeo: new THREE.CylinderGeometry(0.025, 0.025, 0.02, 24),
    };
  }, []);

  const [x, y, z] = bay.position;
  return (
    <group position={[x, y, z]} rotation-y={bay.rotationY ?? 0} scale={bay.scale}>
      {/* Bay: gold heat-shield floor and walls. */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} material={m.foil}>
        <planeGeometry args={[1.62, 0.5]} />
      </mesh>
      <mesh position={[0, 0.3, 0.245]} material={m.foil}>
        <planeGeometry args={[1.62, 0.6]} />
      </mesh>
      <mesh position={[0, 0.3, -0.25]} rotation-y={Math.PI} material={m.blackAnod}>
        <planeGeometry args={[1.62, 0.6]} />
      </mesh>

      {/* Block, heads (90° vee) and crackle cam covers with coil packs. */}
      <mesh geometry={geo.block} position-y={0.2} material={m.cast} castShadow />
      {[1, -1].map((s) => (
        <group key={s} position={[0, 0.39, s * 0.11]} rotation-x={s * 0.62}>
          <mesh geometry={geo.head} material={m.cast} castShadow />
          <mesh geometry={geo.cover} position-y={0.07} material={camCover} castShadow />
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} geometry={geo.coil} position={[-0.24 + i * 0.16, 0.115, 0]} material={m.blackAnod} />
          ))}
        </group>
      ))}

      {/* Carbon plenum with polished throttle bodies. */}
      <mesh geometry={geo.plenum} position-y={0.6} material={m.carbon} castShadow />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={geo.throttle} position={[s * 0.31, 0.6, 0]} rotation-z={Math.PI / 2} material={m.polished} />
      ))}

      {/* Headers, turbos, charge pipes with silicone couplers, tailpipes. */}
      {geo.headerTubes.map((g, i) => (
        <mesh key={i} geometry={g} material={m.headers} castShadow />
      ))}
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.44, 0.3, 0]}>
          <mesh geometry={geo.turbo} rotation-y={Math.PI / 2} material={m.polished} castShadow />
          <mesh geometry={geo.turboCore} rotation-z={Math.PI / 2} material={m.cast} />
        </group>
      ))}
      {geo.charge.map((g, i) => (
        <mesh key={i} geometry={g} material={m.polished} castShadow />
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} geometry={geo.coupler} position={[s * 0.455, 0.47, 0.03]} material={m.silicone} />
      ))}
      {geo.tailpipes.map((g, i) => (
        <mesh key={i} geometry={g} material={m.headers} />
      ))}

      {/* Carbon strut brace, reservoir and filler cap. */}
      <mesh geometry={geo.brace} position={[0, 0.7, -0.05]} material={m.carbon} castShadow />
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.74, 0.7, -0.05]} material={m.polished}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 24]} />
        </mesh>
      ))}
      <mesh geometry={geo.reservoir} position={[0.62, 0.12, 0.14]} material={m.reservoir} />
      <mesh geometry={geo.capGeo} position={[0.62, 0.18, 0.14]} material={m.cap} />
      <mesh geometry={geo.capGeo} position={[-0.18, 0.47, -0.02]} material={m.cap} />

      {/* Display lighting: a warm key over the engine plus LED strips. */}
      <pointLight position={[0, 0.78, 0.05]} color="#ffdcb0" intensity={2.2} distance={1.6} decay={2} />
      <pointLight position={[0, 0.5, -0.2]} color="#ffe9cc" intensity={0.8} distance={1.1} decay={2} />
      {/* Warm LED strips along the bay walls. */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.8, 0.5, 0]} rotation-y={Math.PI / 2} material={m.led}>
          <planeGeometry args={[0.44, 0.012]} />
        </mesh>
      ))}
      <mesh position={[0, 0.58, 0.243]} material={m.led}>
        <planeGeometry args={[1.4, 0.01]} />
      </mesh>
    </group>
  );
}

/** Carpeted luggage tub under the bonnet, with a leather bag in the hide colour. */
export function FrunkAssembly({ materials, frunk }: { materials: VehicleMaterials; frunk: Frunk }) {
  const [w, h, d] = frunk.size;
  const bag = useMemo(() => new RoundedBoxGeometry(w * 0.62, h * 0.42, d * 0.62, 5, 0.05), [w, h, d]);
  const handle = useMemo(() => new THREE.TorusGeometry(0.06, 0.009, 10, 32, Math.PI), []);
  return (
    <group position={frunk.position}>
      <mesh rotation-x={-Math.PI / 2} material={materials.carpet} receiveShadow>
        <planeGeometry args={[w, d]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={`x${s}`} position={[(s * w) / 2, h / 2, 0]} rotation-y={-s * (Math.PI / 2)} material={materials.carpet}>
          <planeGeometry args={[d, h]} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={`z${s}`} position={[0, h / 2, (s * d) / 2]} rotation-y={s > 0 ? Math.PI : 0} material={materials.carpet}>
          <planeGeometry args={[w, h]} />
        </mesh>
      ))}
      <mesh geometry={bag} position={[0, h * 0.21 + 0.005, 0]} material={materials.leather} castShadow />
      <mesh geometry={handle} position={[0, h * 0.42 + 0.005, 0]} material={materials.leatherAccent} />
    </group>
  );
}
