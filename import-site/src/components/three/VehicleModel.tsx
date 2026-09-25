"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, type RefObject } from "react";
import * as THREE from "three";
import type { MaterialSlot, OpenableDef, VehicleModelDefinition } from "@/config/vehicle-models";
import { EngineAssembly, FrunkAssembly } from "./EngineAssembly";
import { brushedRoughnessMap, carbonMaps, grainMap } from "./textures";
import type { VehicleMaterials } from "./vehicle-materials";

export type OpenableId = OpenableDef["id"];

export interface OpenableHandle {
  node: THREE.Object3D;
  closed: THREE.Quaternion;
  axis: THREE.Vector3;
  angle: number;
  swingAxis: THREE.Vector3 | null;
  swingAngle: number;
  /** Eased 0 (closed) → 1 (open), advanced by the scene. */
  value: number;
}

export interface WheelHandle {
  node: THREE.Object3D;
  base: THREE.Quaternion;
  /** Axle and steering axes in the node's parent space. */
  axle: THREE.Vector3;
  up: THREE.Vector3;
  steer: boolean;
}

export interface VehicleHandles {
  wheels: WheelHandle[];
  plate: THREE.Object3D | null;
  openables: Partial<Record<OpenableId, OpenableHandle>>;
  steeringWheel: { node: THREE.Object3D; base: THREE.Quaternion; axis: THREE.Vector3 } | null;
}

export function createVehicleHandles(): VehicleHandles {
  return { wheels: [], plate: null, openables: {}, steeringWheel: null };
}

interface Props {
  model: VehicleModelDefinition;
  materials: VehicleMaterials;
  /** Receives wheel nodes, plate and hinged parts so rigs can animate them. */
  handles?: RefObject<VehicleHandles>;
  shadowOpacity?: number;
  showPlate?: boolean;
  /** Clicking a door / hood / hatch (a click, not a drag). */
  onPartClick?: (id: OpenableId) => void;
  onPartHover?: (id: OpenableId | null) => void;
}

/** Which of the original maps each slot keeps (the rest is ours). */
const ADOPT: Partial<Record<MaterialSlot, ("map" | "normalMap" | "roughnessMap" | "metalnessMap")[]>> = {
  tireSide: ["map", "normalMap"],
  tireTread: ["normalMap"],
  disc: ["map", "normalMap"],
  mechanical: ["normalMap", "roughnessMap", "metalnessMap"],
};
/** Baked AO darkens closed-door seams on paint; skip it there. */
const NO_AO: MaterialSlot[] = ["paint", "accentPaint", "glass", "headlights", "taillights", "signals", "mirror", "plate"];

function applyMaterial(root: THREE.Object3D, names: string[] | undefined, material: THREE.Material) {
  if (!names) return;
  for (const name of names) {
    root.traverse((o) => {
      if (o.name !== name) return;
      o.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = material;
      });
    });
  }
}

/** Israeli licence plate, drawn once to a canvas texture. */
function usePlateTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 1040;
    c.height = 220;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f3c317";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#1f3f9a";
    g.fillRect(0, 0, 150, c.height);
    g.fillStyle = "#ffffff";
    g.font = "700 64px Arial, sans-serif";
    g.textAlign = "center";
    g.fillText("IL", 75, 176);
    g.fillStyle = "#ffffff";
    g.fillRect(35, 30, 80, 56);
    g.fillStyle = "#1f3f9a";
    g.fillRect(35, 38, 80, 6);
    g.fillRect(35, 72, 80, 6);
    g.fillStyle = "#111";
    g.font = "700 150px 'Arial Narrow', Arial, sans-serif";
    g.fillText("512-78-301", 595, 165);
    g.lineWidth = 8;
    g.strokeStyle = "#111";
    g.strokeRect(4, 4, c.width - 8, c.height - 8);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);
}

/** Soft contact shadow for models without a baked one. */
function useContactShadow(url: string | undefined) {
  return useMemo(() => {
    if (url || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, 128, 256);
    g.filter = "blur(14px)";
    g.fillStyle = "#000";
    g.beginPath();
    g.roundRect(26, 30, 76, 196, 30);
    g.fill();
    g.filter = "blur(4px)";
    g.globalAlpha = 0.5;
    g.beginPath();
    g.roundRect(34, 44, 60, 168, 20);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [url]);
}

/** True when a mesh has no usable UVs (all texels would collapse to one). */
function degenerateUV(mesh: THREE.Mesh) {
  const uv = mesh.geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return true;
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < uv.count; i += Math.max(1, Math.floor(uv.count / 200))) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return maxU - minU < 1e-3 && maxV - minV < 1e-3;
}

/** Map-free twin of a slot material that still follows its live colour. */
const plainTwins = new WeakMap<THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial>();
function plainTwin(m: THREE.MeshPhysicalMaterial) {
  let t = plainTwins.get(m);
  if (!t) {
    t = m.clone();
    t.map = t.normalMap = t.roughnessMap = t.aoMap = null;
    t.onBeforeCompile = () => {};
    t.color = m.color;
    plainTwins.set(m, t);
  }
  return t;
}

function slotFor(mesh: THREE.Mesh, model: VehicleModelDefinition): MaterialSlot | undefined {
  const ns = model.nodeSlots;
  if (ns) {
    // Multi-primitive meshes load as a group of child meshes: check the parent too.
    const hit = ns[mesh.name] ?? (mesh.parent ? ns[mesh.parent.name] : undefined);
    if (hit) return hit;
  }
  const name = (mesh.material as THREE.Material | undefined)?.name ?? "";
  return model.materialSlots?.[name];
}

/**
 * True-scale tiling: each procedural map knows its physical tile size;
 * with the slot's UV density (metres per UV unit) that gives the repeat.
 * Maps are cloned (sharing the image) so slots can tile independently.
 */
export function retile(m: THREE.MeshPhysicalMaterial, metresPerUV: number) {
  for (const key of ["map", "normalMap", "roughnessMap"] as const) {
    const t = m[key];
    const tile = t?.userData.tile as [number, number] | undefined;
    if (!t || !tile || t.userData.retiled) continue;
    const c = t.clone();
    c.repeat.set(metresPerUV / tile[0], metresPerUV / tile[1]);
    c.userData = { ...t.userData, retiled: true };
    c.needsUpdate = true;
    m[key] = c;
  }
  m.userData.uvMetres = metresPerUV;
}

function openableOf(o: THREE.Object3D | null): OpenableId | null {
  for (let p = o; p; p = p.parent) if (p.userData.openable) return p.userData.openable as OpenableId;
  return null;
}

export function VehicleModel({ model, materials, handles, shadowOpacity = 1, showPlate = true, onPartClick, onPartHover }: Props) {
  const gltf = useGLTF(model.url, model.draco ? "/draco/" : false);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const bakedShadow = useTexture(model.shadowUrl ?? "/models/studio-car-shadow.png");
  const softShadow = useContactShadow(model.shadowUrl);
  const shadow = softShadow ?? bakedShadow;
  const plateTex = usePlateTexture();
  const slotted = Boolean(model.materialSlots);

  useLayoutEffect(() => {
    applyMaterial(scene, model.parts.paint, materials.paint);
    applyMaterial(scene, model.parts.glass, materials.glass);
    applyMaterial(scene, model.parts.rims, materials.rims);
    applyMaterial(scene, model.parts.trim, materials.trim);
    applyMaterial(scene, model.parts.headlights, materials.headlights);
    applyMaterial(scene, model.parts.taillights, materials.taillights);

    for (const n of model.hide ?? []) {
      const o = scene.getObjectByName(n);
      if (o) o.visible = false;
    }

    /* Slot binding: shared configurable materials, original maps adopted. */
    const adopted = new Set<MaterialSlot>();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const slot = slotFor(m, model);
      if (!slot) return;
      const orig = m.material as THREE.MeshStandardMaterial;
      const target = materials[slot];
      if (!adopted.has(slot)) {
        adopted.add(slot);
        for (const key of ADOPT[slot] ?? []) {
          const t = orig[key];
          if (t) target[key] = t;
        }
        if (orig.aoMap && !NO_AO.includes(slot)) {
          target.aoMap = orig.aoMap;
          target.aoMapIntensity = 1;
        }
        const uvm = model.uvMetres?.[slot];
        if (uvm) retile(target, uvm);
        if (slot === "plate" && plateTex) {
          target.map = plateTex;
          target.transparent = true;
        }
        target.needsUpdate = true;
      }
      m.material = degenerateUV(m) && (target.map || target.normalMap) ? plainTwin(target) : target;
    });

    /* Legacy per-material recolours (models without full slot maps). */
    const overrides = model.materialOverrides ?? {};
    const recoloured = new Map<THREE.Material, THREE.Material>();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const ov = mat?.name ? overrides[mat.name] : undefined;
      if (!ov) return;
      let next = recoloured.get(mat);
      if (!next) {
        const c = new THREE.MeshPhysicalMaterial({
          name: mat.name,
          color: ov.color,
          metalness: ov.metalness ?? mat.metalness ?? 0,
          roughness: ov.roughness ?? mat.roughness ?? 0.5,
          clearcoat: ov.clearcoat ?? 0,
          clearcoatRoughness: ov.clearcoatRoughness ?? 0.1,
          envMapIntensity: ov.envMapIntensity ?? 1,
          side: mat.side,
        });
        if (ov.texture === "carbon") {
          const cm = carbonMaps();
          if (cm) {
            c.map = cm.map;
            c.normalMap = cm.normalMap;
            c.normalScale.set(0.6, 0.6);
          }
        } else if (ov.texture === "brushed") {
          c.roughnessMap = brushedRoughnessMap();
        } else if (ov.texture === "grain") {
          c.bumpMap = grainMap();
          c.bumpScale = 0.6;
        }
        recoloured.set(mat, c);
        next = c;
      }
      m.material = next;
    });

    const own = new Set<THREE.Material>(Object.values(materials));
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = false;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && "envMapIntensity" in mat && !own.has(mat)) mat.envMapIntensity = 0.8;
    });

    if (!handles) return;
    const h = handles.current;

    /* Wheels: spin about the car's lateral axis, steer about its up axis. */
    const upLocal = new THREE.Vector3(0, 1, 0);
    const latLocal = new THREE.Vector3(1, 0, 0);
    const steerSet = new Set(model.parts.steer ?? []);
    h.wheels = (model.parts.wheels ?? [])
      .map((n) => scene.getObjectByName(n))
      .filter((o): o is THREE.Object3D => Boolean(o))
      .map((node) => {
        // Express the scene's lateral / up axes in the wheel's parent space.
        scene.updateMatrixWorld(true);
        const inv = new THREE.Quaternion();
        node.parent?.getWorldQuaternion(inv);
        const sceneQ = new THREE.Quaternion();
        scene.getWorldQuaternion(sceneQ);
        inv.invert().multiply(sceneQ);
        return {
          node,
          base: node.quaternion.clone(),
          axle: latLocal.clone().applyQuaternion(inv).normalize(),
          up: upLocal.clone().applyQuaternion(inv).normalize(),
          steer: steerSet.has(node.name),
        };
      });

    const sw = model.parts.steeringWheel ? scene.getObjectByName(model.parts.steeringWheel) : null;
    h.steeringWheel = sw
      ? { node: sw, base: sw.quaternion.clone(), axis: new THREE.Vector3(0, 1, 0).applyQuaternion(sw.quaternion.clone().invert()).normalize() }
      : null;

    /* Hinged parts. */
    h.openables = {};
    for (const def of model.openables ?? []) {
      const node = scene.getObjectByName(def.node);
      if (!node) continue;
      node.userData.openable = def.id;
      h.openables[def.id] = {
        node,
        closed: node.quaternion.clone(),
        axis: new THREE.Vector3(...def.axis).normalize(),
        angle: def.angle,
        swingAxis: def.swing ? new THREE.Vector3(...def.swing.axis).normalize() : null,
        swingAngle: def.swing?.angle ?? 0,
        value: 0,
      };
    }

    const plateNode = model.materialSlots ? scene.getObjectByName("License Plate") : null;
    if (plateNode) h.plate = plateNode;
  }, [scene, model, materials, handles, plateTex]);

  const plateMaterial = useMemo(() => {
    if (!plateTex) return materials.plate;
    const m = materials.plate.clone();
    m.map = plateTex;
    m.color.set("#ffffff");
    m.transparent = true;
    return m;
  }, [plateTex, materials.plate]);

  const shadowScale = model.shadowScale ?? [model.widthM * 1.25, model.lengthM * 1.18];

  const onClick = onPartClick
    ? (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 6) return;
        const id = openableOf(e.object);
        if (!id) return;
        e.stopPropagation();
        onPartClick(id);
      }
    : undefined;
  const onOver = onPartHover
    ? (e: ThreeEvent<PointerEvent>) => {
        const id = openableOf(e.object);
        onPartHover(id);
        if (id) e.stopPropagation();
      }
    : undefined;
  const onOut = onPartHover ? () => onPartHover(null) : undefined;

  return (
    <group>
      <group rotation-y={model.rotationY} position={model.offset} scale={model.scale}>
        <primitive object={scene} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut} />
        {model.engineBay && <EngineAssembly materials={materials} bay={model.engineBay} />}
        {model.frunk && <FrunkAssembly materials={materials} frunk={model.frunk} />}
        <mesh rotation-x={-Math.PI / 2} position-y={0.002} renderOrder={2}>
          <planeGeometry args={shadowScale} />
          <meshBasicMaterial
            map={shadow}
            blending={THREE.MultiplyBlending}
            toneMapped={false}
            transparent
            premultipliedAlpha
            opacity={shadowOpacity}
            depthWrite={false}
          />
        </mesh>
      </group>
      {showPlate && !slotted && (
        <mesh
          ref={(m) => {
            if (handles) handles.current.plate = m;
          }}
          position={[0, 0.47, -2.215]}
          rotation-y={Math.PI}
          visible={false}
        >
          <planeGeometry args={[0.52, 0.11]} />
          <primitive object={plateMaterial} attach="material" />
        </mesh>
      )}
    </group>
  );
}

/* ── Per-frame animation helpers (shared by the stage and the viewer) ── */

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

/** Spin (and optionally steer) the wheels. */
export function poseWheels(h: VehicleHandles, spin: number, steer = 0) {
  for (const w of h.wheels) {
    // Parent-space rotations: roll about the axle, then steer the axle itself.
    w.node.quaternion.copy(w.base).premultiply(qa.setFromAxisAngle(w.axle, spin));
    if (w.steer && steer) w.node.quaternion.premultiply(qb.setFromAxisAngle(w.up, steer));
  }
  if (h.steeringWheel) {
    h.steeringWheel.node.quaternion.copy(h.steeringWheel.base).multiply(qa.setFromAxisAngle(h.steeringWheel.axis, -steer * 9));
  }
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Moves every hinged part toward its target (0 closed → 1 open) at a
 * weighty, damped pace, with the swing easing in after the lift.
 */
export function poseOpenables(h: VehicleHandles, targets: Partial<Record<OpenableId, number>>, dt: number, snap = false) {
  let moving = false;
  for (const [id, o] of Object.entries(h.openables) as [OpenableId, OpenableHandle][]) {
    const want = targets[id] ?? 0;
    if (o.value !== want) moving = true;
    if (snap) o.value = want;
    else {
      const step = dt / 1.1;
      o.value = want > o.value ? Math.min(want, o.value + step) : Math.max(want, o.value - step);
    }
    const t = ease(o.value);
    o.node.quaternion.copy(o.closed).multiply(qa.setFromAxisAngle(o.axis, o.angle * t));
    if (o.swingAxis) o.node.quaternion.multiply(qb.setFromAxisAngle(o.swingAxis, o.swingAngle * ease(Math.max(0, t * 1.4 - 0.4))));
  }
  return moving;
}
