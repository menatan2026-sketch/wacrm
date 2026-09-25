import * as THREE from "three";
import { paintOptions, wheelFinishOptions, type PaintOption, type WheelFinishOption } from "@/config/vehicle-models";

/**
 * Shared, mutable material set for a vehicle. Scenes lerp these toward
 * targets every frame (paint changes glide instead of snapping).
 */
export interface VehicleMaterials {
  paint: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  rims: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  headlights: THREE.MeshStandardMaterial;
  taillights: THREE.MeshStandardMaterial;
  plate: THREE.MeshStandardMaterial;
}

export function createVehicleMaterials(): VehicleMaterials {
  const p = paintOptions[0];
  const w = wheelFinishOptions[0];
  return {
    paint: new THREE.MeshPhysicalMaterial({
      color: p.color,
      metalness: p.metalness,
      roughness: p.roughness,
      clearcoat: 1,
      clearcoatRoughness: p.clearcoatRoughness,
      envMapIntensity: 1.1,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#0b0d10",
      metalness: 0.25,
      roughness: 0.02,
      transmission: 0,
      transparent: true,
      opacity: 0.72,
      clearcoat: 1,
      envMapIntensity: 1.6,
    }),
    rims: new THREE.MeshStandardMaterial({ color: w.color, metalness: w.metalness, roughness: w.roughness, envMapIntensity: 0.55 }),
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
}

export function lerpWheel(m: THREE.MeshStandardMaterial, target: WheelFinishOption, k: number) {
  tmp.set(target.color);
  m.color.lerp(tmp, k);
  m.metalness += (target.metalness - m.metalness) * k;
  m.roughness += (target.roughness - m.roughness) * k;
}

export function findPaint(id: string) {
  return paintOptions.find((p) => p.id === id) ?? paintOptions[0];
}
export function findWheel(id: string) {
  return wheelFinishOptions.find((w) => w.id === id) ?? wheelFinishOptions[0];
}
