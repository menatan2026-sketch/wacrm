"use client";

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LAND_MASK_BASE64, LAND_MASK_COUNT } from "@/data/generated/land-mask";
import { DESTINATION, markets } from "@/data/markets";
import { setStageConfig } from "./director";
import { sceneAnchors } from "./anchors";

/**
 * Sourcing globe: a dotted planet with routes from every market into
 * Israel. Israel sits at the globe's north pole in local space, so a
 * spin around local Y rotates the world around the destination.
 */

export function latLngToVec3(lat: number, lng: number, r = 1, out = new THREE.Vector3()) {
  const la = THREE.MathUtils.degToRad(lat);
  const ln = THREE.MathUtils.degToRad(lng);
  return out.set(Math.cos(la) * Math.cos(ln) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(ln) * r);
}

/** Rotation that brings Israel to +Y, with Europe roughly toward +Z (the camera). */
export const GLOBE_ALIGN = (() => {
  const il = latLngToVec3(DESTINATION.lat, DESTINATION.lng);
  const q = new THREE.Quaternion().setFromUnitVectors(il, new THREE.Vector3(0, 1, 0));
  // Spin around the new up axis so Western Europe faces the camera.
  const de = latLngToVec3(48, 2).applyQuaternion(q);
  const ang = Math.atan2(de.x, de.z);
  const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang);
  return spin.multiply(q);
})();

function decodeLand(step: number) {
  const bin = atob(LAND_MASK_BASE64);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts: number[] = [];
  const v = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < LAND_MASK_COUNT; i++) {
    if (!((bin.charCodeAt(i >> 3) >> (i & 7)) & 1)) continue;
    if (k++ % step) continue;
    const y = 1 - (i / (LAND_MASK_COUNT - 1)) * 2;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lng = (((((golden * i * 180) / Math.PI) % 360) + 540) % 360) - 180;
    latLngToVec3(lat, lng, 1, v);
    pts.push(v.x, v.y, v.z);
  }
  return new Float32Array(pts);
}

function arcPoints(from: THREE.Vector3, to: THREE.Vector3, segments = 72) {
  const angle = from.angleTo(to);
  const lift = 0.03 + (angle / Math.PI) * 0.2;
  const pts: THREE.Vector3[] = [];
  const axis = new THREE.Vector3().crossVectors(from, to).normalize();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = from.clone().applyAxisAngle(axis, angle * t);
    p.multiplyScalar(1 + Math.sin(Math.PI * t) * lift);
    pts.push(p);
  }
  return pts;
}

export interface GlobeState {
  opacity: number;
  /** 0→1 route drawing progress. */
  draw: number;
  /** Extra spin around Israel (radians). */
  spin: number;
  /** Market currently focused (hover/tap) — brightens its route. */
  focus: string | null;
}

export function Globe({ radius, state, lowDetail = false }: { radius: number; state: GlobeState; lowDetail?: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const spinGroup = useRef<THREE.Group>(null!);
  const alignGroup = useRef<THREE.Group>(null!);
  const { size, camera } = useThree();

  const land = useMemo(() => decodeLand(lowDetail ? 2 : 1), [lowDetail]);

  const dotMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uOpacity: { value: 0 },
          uSize: { value: 0.011 },
          uProj: { value: 800 },
          uScale: { value: 1 },
          uDest: { value: new THREE.Vector3(0, 1, 0) },
        },
        vertexShader: /* glsl */ `
          uniform float uSize; uniform float uProj; uniform float uScale; uniform vec3 uDest;
          varying float vFacing; varying float vNear;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec3 n = normalize(normalMatrix * position);
            vFacing = dot(n, normalize(-mv.xyz));
            vNear = smoothstep(0.35, 0.0, distance(position, uDest));
            gl_Position = projectionMatrix * mv;
            gl_PointSize = max(1.0, uSize * uScale * uProj / -mv.z * (1.0 + vNear * 0.6));
          }`,
        fragmentShader: /* glsl */ `
          uniform float uOpacity; varying float vFacing; varying float vNear;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float a = smoothstep(0.5, 0.2, d) * smoothstep(-0.05, 0.35, vFacing);
            vec3 col = mix(vec3(0.46, 0.5, 0.58), vec3(0.95, 0.86, 0.72), vNear);
            gl_FragColor = vec4(col, a * uOpacity * (0.55 + vNear * 0.45));
          }`,
      }),
    [],
  );

  const sphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: /* glsl */ `uniform float uOpacity; varying vec3 vN; varying vec3 vV;
          void main(){ float f = 1.0 - max(dot(vN, vV), 0.0);
          vec3 col = vec3(0.018, 0.02, 0.026) + vec3(0.25, 0.3, 0.4) * pow(f, 3.0) * 0.6;
          gl_FragColor = vec4(col, uOpacity); }`,
      }),
    [],
  );

  const atmosphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: /* glsl */ `uniform float uOpacity; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(max(0.0, 0.62 - dot(vN, vV)), 3.0);
          gl_FragColor = vec4(vec3(0.32, 0.4, 0.58) * f * 0.9, f * uOpacity); }`,
      }),
    [],
  );

  const dest = useMemo(() => latLngToVec3(DESTINATION.lat, DESTINATION.lng), []);

  const routes = useMemo(
    () =>
      markets.map((m, i) => {
        const from = latLngToVec3(m.lat, m.lng);
        const pts = arcPoints(from, dest);
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(curve, 96, 0.0032, 6, false);
        const material = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
            uDraw: { value: 0 },
            uTime: { value: 0 },
            uOpacity: { value: 0 },
            uFocus: { value: 0 },
            uOffset: { value: i * 0.37 },
          },
          vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
          fragmentShader: /* glsl */ `
            uniform float uDraw; uniform float uTime; uniform float uOpacity; uniform float uFocus; uniform float uOffset;
            varying vec2 vUv;
            void main(){
              float x = vUv.x;
              if (x > uDraw) discard;
              float head = exp(-pow((x - uDraw) * 28.0, 2.0)) * step(uDraw, 0.999);
              float pulse = exp(-pow(fract(x - uTime * 0.22 - uOffset) - 0.5, 2.0) * 900.0) * step(0.999, uDraw);
              float base = 0.28 + uFocus * 0.5;
              vec3 col = mix(vec3(0.85, 0.72, 0.55), vec3(1.0, 0.93, 0.82), uFocus);
              float a = (base + head * 1.6 + pulse * (1.2 + uFocus)) * smoothstep(0.0, 0.03, x);
              gl_FragColor = vec4(col * (1.0 + head + pulse), a * uOpacity);
            }`,
        });
        return { market: m, from, geo, material };
      }),
    [dest],
  );

  const ringGeo = useMemo(() => new THREE.RingGeometry(0.9, 1, 48), []);
  const dotGeo = useMemo(() => new THREE.CircleGeometry(1, 24), []);

  // Anchors for DOM labels.
  const anchorObjects = useMemo(() => {
    const map = new Map<string, THREE.Object3D>();
    for (const m of markets) {
      const o = new THREE.Object3D();
      o.position.copy(latLngToVec3(m.lat, m.lng, 1.012));
      map.set(`market:${m.code}`, o);
    }
    const il = new THREE.Object3D();
    il.position.copy(dest).multiplyScalar(1.012);
    map.set("market:IL", il);
    return map;
  }, [dest]);

  useEffect(() => {
    const sg = alignGroup.current;
    anchorObjects.forEach((o, k) => {
      sg.add(o);
      sceneAnchors.set(k, o);
    });
    return () => {
      anchorObjects.forEach((o, k) => {
        sg.remove(o);
        if (sceneAnchors.get(k) === o) sceneAnchors.delete(k);
      });
    };
  }, [anchorObjects]);

  const pulseRefs = useRef<THREE.Mesh[]>([]);
  const markerRefs = useRef<THREE.Group[]>([]);
  const worldScale = useMemo(() => new THREE.Vector3(), []);
  const focusLevels = useRef<number[]>(markets.map(() => 0));

  useFrame((_, dt) => {
    const o = state.opacity;
    group.current.visible = o > 0.002;
    if (!group.current.visible) return;

    group.current.getWorldScale(worldScale);
    const persp = camera as THREE.PerspectiveCamera;
    dotMaterial.uniforms.uProj.value = size.height / (2 * Math.tan(THREE.MathUtils.degToRad(persp.fov) / 2));
    dotMaterial.uniforms.uScale.value = worldScale.x;
    dotMaterial.uniforms.uOpacity.value = o;
    sphereMaterial.uniforms.uOpacity.value = o;
    atmosphereMaterial.uniforms.uOpacity.value = o;

    spinGroup.current.rotation.y = state.spin;

    routes.forEach((r, i) => {
      const start = i * 0.07;
      const d = THREE.MathUtils.clamp((state.draw - start) / 0.45, 0, 1);
      const focused = state.focus === r.market.code ? 1 : 0;
      focusLevels.current[i] += (focused - focusLevels.current[i]) * (1 - Math.exp(-dt * 8));
      r.material.uniforms.uDraw.value = d;
      r.material.uniforms.uTime.value += dt;
      const dim = state.focus && !focused ? 0.45 : 1;
      r.material.uniforms.uOpacity.value = o * dim;
      r.material.uniforms.uFocus.value = focusLevels.current[i];
      const marker = markerRefs.current[i];
      if (marker) {
        const s = (0.012 + focusLevels.current[i] * 0.008) * Math.min(1, d * 6 + (state.draw > start ? 0.4 : 0));
        marker.scale.setScalar(Math.max(0.0001, s));
      }
    });

    const t = performance.now() / 1000;
    pulseRefs.current.forEach((m, i) => {
      if (!m) return;
      const ph = (t * 0.5 + i * 0.5) % 1;
      m.scale.setScalar(0.02 + ph * 0.07);
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * 0.7 * o;
    });
  });

  const orient = (v: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize());

  const onOver = (code: string) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (state.opacity < 0.5) return;
    setStageConfig({ market: code });
    document.body.dataset.cursor = "explore";
  };
  const onOut = () => {
    document.body.dataset.cursor = "";
  };

  return (
    <group ref={group} position={[0, -radius, 0]} scale={radius} visible={false}>
      {/* Spin happens around the world axis *after* alignment, so Israel stays put at the pole. */}
      <group ref={spinGroup}>
        <group ref={alignGroup} quaternion={GLOBE_ALIGN}>
          <mesh material={sphereMaterial} renderOrder={1}>
            <sphereGeometry args={[0.975, 96, 64]} />
          </mesh>
          <points material={dotMaterial} renderOrder={2} frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[land, 3]} />
            </bufferGeometry>
          </points>
          <mesh material={atmosphereMaterial} scale={1.1} renderOrder={0}>
            <sphereGeometry args={[1, 64, 32]} />
          </mesh>

          {routes.map((r, i) => (
            <group key={r.market.code}>
              <mesh geometry={r.geo} material={r.material} renderOrder={3} />
              <group
                ref={(g) => {
                  if (g) markerRefs.current[i] = g;
                }}
                position={r.from.clone().multiplyScalar(1.003)}
                quaternion={orient(r.from)}
              >
                <mesh geometry={dotGeo} renderOrder={4}>
                  <meshBasicMaterial color="#f0dcc0" toneMapped={false} transparent depthWrite={false} />
                </mesh>
              </group>
              {/* Generous invisible hit target for hover/tap */}
              <mesh
                position={r.from}
                onPointerOver={onOver(r.market.code)}
                onPointerOut={onOut}
                onClick={onOver(r.market.code)}
              >
                <sphereGeometry args={[0.07, 12, 8]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
              </mesh>
            </group>
          ))}

          <group position={dest.clone().multiplyScalar(1.004)} quaternion={orient(dest)}>
            <mesh geometry={dotGeo} scale={0.016} renderOrder={5}>
              <meshBasicMaterial color="#fff4e2" toneMapped={false} />
            </mesh>
            {[0, 1].map((i) => (
              <mesh
                key={i}
                geometry={ringGeo}
                renderOrder={5}
                ref={(m) => {
                  if (m) pulseRefs.current[i] = m;
                }}
              >
                <meshBasicMaterial color="#f3d9b4" transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}
