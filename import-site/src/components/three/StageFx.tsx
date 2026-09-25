"use client";

import { useFrame } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

/* ── Backdrop: a soft cyclorama glow behind the car ───────────────── */

export interface BackdropHandle {
  uniforms: { uGlow: { value: THREE.Color }; uGlowStrength: { value: number }; uBase: { value: THREE.Color }; uHorizon: { value: THREE.Color }; uHorizonStrength: { value: number } };
}

export const Backdrop = forwardRef<BackdropHandle>(function Backdrop(_, ref) {
  const uniforms = useMemo(
    () => ({
      uGlow: { value: new THREE.Color("#4a4f58") },
      uGlowStrength: { value: 0.6 },
      uBase: { value: new THREE.Color("#030304") },
      uHorizon: { value: new THREE.Color("#ff7a3a") },
      uHorizonStrength: { value: 0 },
    }),
    [],
  );
  const mat = useRef<THREE.ShaderMaterial>(null!);
  // R3F copies each uniform into the material, so hand out the material's own.
  useImperativeHandle(ref, () => ({ get uniforms() { return mat.current.uniforms as typeof uniforms; } }), []);
  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[80, 48, 24]} />
      <shaderMaterial
        ref={mat}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`}
        fragmentShader={/* glsl */ `
          uniform vec3 uGlow; uniform float uGlowStrength; uniform vec3 uBase;
          uniform vec3 uHorizon; uniform float uHorizonStrength;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            // Soft pool of light behind and above the car.
            float glow = exp(-pow(length(vec2(vDir.x * 1.6, h - 0.08)) * 2.2, 2.0));
            float horizon = exp(-pow((h - 0.02) * 11.0, 2.0));
            vec3 col = uBase + uGlow * glow * uGlowStrength + uHorizon * horizon * uHorizonStrength;
            // Infinity-cove falloff: the wall darkens into the floor, so there's no horizon line.
            col *= smoothstep(-0.02, 0.22, h) * 0.85 + 0.15;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`}
      />
    </mesh>
  );
});

/* ── Dust: slow motes drifting through the light ─────────────────── */

export interface DustHandle {
  uniforms: { uTime: { value: number }; uFlow: { value: number }; uOpacity: { value: number }; uScale: { value: number } };
}

export const Dust = forwardRef<DustHandle, { count: number }>(function Dust({ count }, ref) {
  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = Math.random() * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 18;
      seeds[i] = Math.random();
    }
    return { positions, seeds };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uOpacity: { value: 1 },
      uScale: { value: 1 },
      uPixelRatio: { value: 1 },
    }),
    [],
  );
  useImperativeHandle(ref, () => ({ uniforms }), [uniforms]);
  const flowOffset = useRef(0);

  useFrame((state, dt) => {
    uniforms.uTime.value += dt;
    flowOffset.current += dt * uniforms.uFlow.value * 22;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
  });

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { ...uniforms, uFlowOffset: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float uTime; uniform float uFlowOffset; uniform float uFlow; uniform float uScale; uniform float uPixelRatio;
          attribute float aSeed;
          varying float vAlpha;
          void main() {
            vec3 p = position;
            p.x += sin(uTime * 0.12 + aSeed * 40.0) * 0.6;
            p.y += sin(uTime * 0.09 + aSeed * 13.0) * 0.4 + uTime * 0.03 * (0.5 + aSeed);
            p.z += cos(uTime * 0.1 + aSeed * 21.0) * 0.6 + uFlowOffset * (0.6 + aSeed);
            p.y = mod(p.y, 6.0);
            p.z = mod(p.z + 9.0, 18.0) - 9.0;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float size = (0.35 + aSeed * 1.1) * (1.0 + uFlow * 1.5);
            gl_PointSize = size * uScale * uPixelRatio * (18.0 / -mv.z);
            float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + aSeed * 50.0);
            vAlpha = twinkle * smoothstep(0.0, 0.8, p.y) * smoothstep(4.2, 2.2, p.y) * smoothstep(9.0, 3.0, length(p.xz));
          }`,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vec3(0.85, 0.88, 0.95), a * vAlpha * uOpacity * 0.42);
          }`,
      }),
    [uniforms],
  );

  useFrame(() => {
    material.uniforms.uFlowOffset.value = flowOffset.current;
  });

  return (
    <points frustumCulled={false} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
    </points>
  );
});

/* ── Speed lines: long streaks for the shipping sequence ─────────── */

export const SpeedLines = forwardRef<THREE.InstancedMesh, { count?: number }>(function SpeedLines({ count = 140 }, ref) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  useImperativeHandle(ref, () => mesh.current);
  const data = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 16,
        y: Math.random() * 5,
        z: (Math.random() - 0.5) * 60,
        speed: 0.6 + Math.random() * 1.2,
        len: 1.5 + Math.random() * 5,
      })).filter((d) => Math.abs(d.x) > 1.6 || d.y > 1.8),
    [count],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const mat = m.material as THREE.MeshBasicMaterial;
    if (mat.opacity < 0.005) {
      m.visible = false;
      return;
    }
    m.visible = true;
    data.forEach((d, i) => {
      d.z += dt * d.speed * 38;
      if (d.z > 30) d.z -= 60;
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.set(0.012, 0.012, d.len);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, data.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#9fb6ff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
});

/* ── Line frames: the shipping container and the customs gate ────── */

function boxEdges(w: number, h: number, d: number, ribs: number) {
  const pts: number[] = [];
  const x = w / 2;
  const z = d / 2;
  const seg = (a: number[], b: number[]) => pts.push(...a, ...b);
  // 12 edges
  for (const yy of [0, h]) {
    seg([-x, yy, -z], [x, yy, -z]);
    seg([x, yy, -z], [x, yy, z]);
    seg([x, yy, z], [-x, yy, z]);
    seg([-x, yy, z], [-x, yy, -z]);
  }
  for (const [xx, zz] of [[-x, -z], [x, -z], [x, z], [-x, z]]) seg([xx, 0, zz], [xx, h, zz]);
  // Corrugation ribs along the sides.
  for (let i = 1; i < ribs; i++) {
    const zz = -z + (d * i) / ribs;
    seg([-x, 0.02, zz], [-x, h - 0.02, zz]);
    seg([x, 0.02, zz], [x, h - 0.02, zz]);
    seg([-x, h, zz], [x, h, zz]);
  }
  // Door bars at the rear.
  for (const xx of [-x * 0.5, x * 0.5]) seg([xx, 0, -z], [xx, h, -z]);
  return new Float32Array(pts);
}

export interface LineFrameHandle {
  setProgress(p: number): void;
  setOpacity(o: number): void;
  group: THREE.Group;
}

export const ContainerFrame = forwardRef<LineFrameHandle>(function ContainerFrame(_, ref) {
  const group = useRef<THREE.Group>(null!);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(boxEdges(2.44, 2.59, 6.06, 18), 3));
    return g;
  }, []);
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#c9d6ff", transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
    [],
  );
  const total = geo.getAttribute("position").count;
  useImperativeHandle(
    ref,
    () => ({
      group: group.current,
      setProgress(p: number) {
        const n = Math.floor((total / 2) * Math.min(1, Math.max(0, p))) * 2;
        geo.setDrawRange(0, n);
      },
      setOpacity(o: number) {
        mat.opacity = o;
        group.current.visible = o > 0.003;
      },
    }),
    [geo, mat, total],
  );
  return (
    <group ref={group} visible={false}>
      <lineSegments geometry={geo} material={mat} />
    </group>
  );
});

export const LightGate = forwardRef<THREE.Group>(function LightGate(_, ref) {
  const group = useRef<THREE.Group>(null!);
  useImperativeHandle(ref, () => group.current);
  return (
    <group ref={group} visible={false}>
      {[
        { p: [0, 2.6, 0], s: [3.4, 0.03, 0.03] },
        { p: [-1.7, 1.3, 0], s: [0.03, 2.6, 0.03] },
        { p: [1.7, 1.3, 0], s: [0.03, 2.6, 0.03] },
      ].map((b, i) => (
        <mesh key={i} position={b.p as [number, number, number]} scale={b.s as [number, number, number]}>
          <boxGeometry />
          <meshBasicMaterial color="#e9c79c" toneMapped={false} transparent opacity={1} />
        </mesh>
      ))}
      <mesh position={[0, 1.3, 0]}>
        <planeGeometry args={[3.4, 2.6]} />
        <meshBasicMaterial
          color="#e9c79c"
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
});

/* ── Scanner: a vertical sheet of light swept along the car ─────── */

export const Scanner = forwardRef<THREE.Mesh>(function Scanner(_, ref) {
  const mesh = useRef<THREE.Mesh>(null!);
  useImperativeHandle(ref, () => mesh.current);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity; uniform float uTime; varying vec2 vUv;
          void main(){
            vec2 e = min(vUv, 1.0 - vUv);
            float border = exp(-min(e.x * 3.0, e.y) * 90.0);
            float fill = 0.07 * smoothstep(0.0, 0.25, e.x * 3.0) * smoothstep(0.0, 0.2, e.y);
            float lines = 0.05 * step(0.5, fract(vUv.y * 60.0 - uTime * 2.0));
            vec3 col = vec3(0.7, 0.83, 1.0);
            gl_FragColor = vec4(col, (border * 0.9 + fill + lines * fill * 8.0) * uOpacity);
          }`,
      }),
    [],
  );
  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt;
  });
  return (
    <mesh ref={mesh} material={material} visible={false}>
      <planeGeometry args={[3.0, 1.7]} />
    </mesh>
  );
});

/* ── Headlight glow: additive sprites + light cones ──────────────── */

export const HeadlightGlow = forwardRef<THREE.Group, { positions: [number, number, number][] }>(function HeadlightGlow(
  { positions },
  ref,
) {
  const group = useRef<THREE.Group>(null!);
  useImperativeHandle(ref, () => group.current);
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.15, "rgba(235,242,255,0.7)");
    grd.addColorStop(0.45, "rgba(180,200,255,0.12)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  const cone = useMemo(() => {
    const g = new THREE.ConeGeometry(1.4, 7, 32, 1, true);
    g.translate(0, -3.5, 0);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const coneMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `varying float vZ; varying vec3 vN; varying vec3 vView;
          void main(){ vZ = position.z / 7.0; vec4 mv = modelViewMatrix * vec4(position,1.0);
          vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */ `uniform float uOpacity; varying float vZ; varying vec3 vN; varying vec3 vView;
          void main(){ float rim = pow(1.0 - abs(dot(vN, vView)), 1.5);
          float a = (1.0 - vZ) * (1.0 - vZ) * (0.35 - rim * 0.3) * uOpacity;
          gl_FragColor = vec4(0.85, 0.9, 1.0, max(a, 0.0) * 0.35); }`,
      }),
    [],
  );
  return (
    <group ref={group} visible={false} userData={{ coneMat }}>
      {positions.map((p, i) => (
        <group key={i} position={p}>
          <sprite scale={[0.9, 0.9, 1]}>
            <spriteMaterial map={tex} blending={THREE.AdditiveBlending} depthWrite={false} transparent toneMapped={false} opacity={0} />
          </sprite>
          <mesh geometry={cone} material={coneMat} />
        </group>
      ))}
    </group>
  );
});

/** Sets opacity on every sprite/cone material of a HeadlightGlow group. */
export function setHeadlightGlow(group: THREE.Group | null, opacity: number) {
  if (!group) return;
  group.visible = opacity > 0.003;
  group.traverse((o) => {
    const s = o as THREE.Sprite;
    if (s.isSprite) (s.material as THREE.SpriteMaterial).opacity = opacity;
  });
  const cone = group.userData.coneMat as THREE.ShaderMaterial | undefined;
  if (cone) cone.uniforms.uOpacity.value = opacity;
}

/* ── Floor fade: dissolves the studio floor into the backdrop ───── */

export interface FloorFadeHandle {
  uniforms: { uInner: { value: number }; uOuter: { value: number }; uColor: { value: THREE.Color }; uStrength: { value: number } };
}

export const FloorFade = forwardRef<FloorFadeHandle>(function FloorFade(_, ref) {
  const uniforms = useMemo(
    () => ({ uInner: { value: 3.5 }, uOuter: { value: 15 }, uColor: { value: new THREE.Color("#030304") }, uStrength: { value: 1 } }),
    [],
  );
  const mat = useRef<THREE.ShaderMaterial>(null!);
  useImperativeHandle(ref, () => ({ get uniforms() { return mat.current.uniforms as typeof uniforms; } }), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.0015} renderOrder={1}>
      <planeGeometry args={[240, 240]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={/* glsl */ `varying vec2 vXZ; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`}
        fragmentShader={/* glsl */ `uniform float uInner; uniform float uOuter; uniform vec3 uColor; uniform float uStrength; varying vec2 vXZ;
          void main(){ float r = length(vXZ * vec2(1.0, 0.8)); float a = smoothstep(uInner, uOuter, r) * uStrength;
          gl_FragColor = vec4(uColor, a); 
          #include <colorspace_fragment>
          }`}
      />
    </mesh>
  );
});

/* ── Floor glow: the pool of light the car stands in ─────────────── */

export const FloorGlow = forwardRef<THREE.Mesh>(function FloorGlow(_, ref) {
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={0.001} renderOrder={0}>
      <circleGeometry args={[9, 64]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{ uStrength: { value: 1 }, uColor: { value: new THREE.Color("#8d95a3") } }}
        vertexShader={/* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={/* glsl */ `uniform float uStrength; uniform vec3 uColor; varying vec2 vP;
          void main(){ float r = length(vP * vec2(1.0, 0.62)) / 9.0; float a = exp(-r * r * 9.0) * 0.07 * uStrength;
          gl_FragColor = vec4(uColor * a, 1.0); }`}
      />
    </mesh>
  );
});
