import * as THREE from "three";
import { paintOptions, wheelFinishOptions, type PaintOption, type WheelFinishOption } from "@/config/vehicle-models";
import { flakeNormalMap } from "./textures";

/**
 * Shared, mutable material set for a vehicle. Scenes lerp these toward
 * targets every frame (paint changes glide instead of snapping).
 */
export interface VehicleMaterials {
  paint: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  rims: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshStandardMaterial;
  headlights: THREE.MeshStandardMaterial;
  taillights: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
}

export function createVehicleMaterials(): VehicleMaterials {
  const p = paintOptions[0];
  const w = wheelFinishOptions[0];
  const flakes = flakeNormalMap();
  return {
    // Two-layer automotive paint: a metallic base with flake sparkle
    // (normal map) under a smooth, glossy clear coat.
    paint: new THREE.MeshPhysicalMaterial({
      color: p.color,
      metalness: p.metalness,
      roughness: p.roughness,
      normalMap: flakes,
      normalScale: new THREE.Vector2(0.05, 0.05),
      clearcoat: 1,
      clearcoatRoughness: p.clearcoatRoughness,
      specularIntensity: 1,
      envMapIntensity: 1.1,
    }),
    // Tinted laminated glass: dark, very smooth, strongly reflective at
    // grazing angles, see-through head-on.
    glass: new THREE.MeshPhysicalMaterial({
      color: "#0d1116",
      metalness: 0,
      roughness: 0,
      ior: 1.52,
      specularIntensity: 1,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      clearcoat: 1,
      clearcoatRoughness: 0,
      envMapIntensity: 1.7,
    }),
    rims: new THREE.MeshPhysicalMaterial({
      color: w.color,
      metalness: w.metalness,
      roughness: w.roughness,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.7,
    }),
    trim: new THREE.MeshStandardMaterial({ color: "#1a1b1e", metalness: 0.9, roughness: 0.35, envMapIntensity: 0.6 }),
    headlights: new THREE.MeshStandardMaterial({
      color: "#dfe6ee",
      emissive: new THREE.Color("#eef4ff"),
      emissiveIntensity: 0,
      metalness: 0.2,
      roughness: 0.1,
    }),
    taillights: new THREE.MeshStandardMaterial({
      color: "#3a0406",
      emissive: new THREE.Color("#ff1a1a"),
      emissiveIntensity: 0,
      metalness: 0.3,
      roughness: 0.2,
    }),
    plate: new THREE.MeshStandardMaterial({ color: "#f2c21b", roughness: 0.45, metalness: 0 }),
  };
}

const tmp = new THREE.Color();

/** Frame-rate independent approach toward a paint target. */
export function lerpPaint(m: THREE.MeshPhysicalMaterial, target: PaintOption, k: number) {
  tmp.set(target.color);
  m.color.lerp(tmp, k);
  m.metalness += (target.metalness - m.metalness) * k;
  m.roughness += (target.roughness - m.roughness) * k;
  m.clearcoatRoughness += (target.clearcoatRoughness - m.clearcoatRoughness) * k;
  // Flake sparkle only belongs to metallic paints; solids stay smooth.
  const flake = 0.01 + 0.05 * target.metalness;
  m.normalScale.x += (flake - m.normalScale.x) * k;
  m.normalScale.y = m.normalScale.x;
}

export function lerpWheel(m: THREE.MeshPhysicalMaterial, target: WheelFinishOption, k: number) {
  tmp.set(target.color);
  m.color.lerp(tmp, k);
  m.metalness += (target.metalness - m.metalness) * k;
  m.roughness += (target.roughness - m.roughness) * k;
  m.clearcoat += ((target.roughness < 0.2 ? 1 : 0.5) - m.clearcoat) * k;
}

export function findPaint(id: string) {
  return paintOptions.find((p) => p.id === id) ?? paintOptions[0];
}
export function findWheel(id: string) {
  return wheelFinishOptions.find((w) => w.id === id) ?? wheelFinishOptions[0];
}
