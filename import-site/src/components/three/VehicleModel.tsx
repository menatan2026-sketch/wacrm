"use client";

import { useGLTF, useTexture } from "@react-three/drei";
import { useLayoutEffect, useMemo, type RefObject } from "react";
import * as THREE from "three";
import type { VehicleModelDefinition } from "@/config/vehicle-models";
import { brushedRoughnessMap, carbonMaps, grainMap } from "./textures";
import type { VehicleMaterials } from "./vehicle-materials";

export interface VehicleHandles {
  wheels: THREE.Object3D[];
  plate: THREE.Mesh | null;
}

interface Props {
  model: VehicleModelDefinition;
  materials: VehicleMaterials;
  /** Receives wheel nodes + plate so rigs can animate them per frame. */
  handles?: RefObject<VehicleHandles>;
  shadowOpacity?: number;
  showPlate?: boolean;
}

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

export function VehicleModel({ model, materials, handles, shadowOpacity = 1, showPlate = true }: Props) {
  const gltf = useGLTF(model.url, model.draco ? "/draco/" : false);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const shadow = useTexture(model.shadowUrl ?? "/models/studio-car-shadow.png");
  const plateTex = usePlateTexture();

  useLayoutEffect(() => {
    applyMaterial(scene, model.parts.paint, materials.paint);
    applyMaterial(scene, model.parts.glass, materials.glass);
    applyMaterial(scene, model.parts.rims, materials.rims);
    applyMaterial(scene, model.parts.trim, materials.trim);
    applyMaterial(scene, model.parts.headlights, materials.headlights);
    applyMaterial(scene, model.parts.taillights, materials.taillights);
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
        // Upgrade to a physical material so clear coat / textures are available.
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
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        // Tame the original interior materials so they sit in the studio light.
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && "envMapIntensity" in mat && !Object.values(materials).includes(mat as never)) {
          mat.envMapIntensity = 0.8;
        }
      }
    });
    if (handles) {
      handles.current.wheels = (model.parts.wheels ?? [])
        .map((n) => scene.getObjectByName(n))
        .filter((o): o is THREE.Object3D => Boolean(o));
    }
  }, [scene, model, materials, handles]);

  const plateMaterial = useMemo(() => {
    if (!plateTex) return materials.plate;
    const m = materials.plate.clone();
    m.map = plateTex;
    m.color.set("#ffffff");
    m.transparent = true;
    return m;
  }, [plateTex, materials.plate]);

  return (
    <group>
      <group rotation-y={model.rotationY} position={model.offset} scale={model.scale}>
        <primitive object={scene} />
        <mesh rotation-x={-Math.PI / 2} position-y={0.002} renderOrder={2}>
          <planeGeometry args={model.shadowScale ?? [2.6, 5.2]} />
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
      {showPlate && (
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

export function preloadVehicleModel(model: VehicleModelDefinition) {
  useGLTF.preload(model.url, model.draco ? "/draco/" : false);
}
