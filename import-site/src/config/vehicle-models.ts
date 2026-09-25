/**
 * 3D vehicle model registry.
 *
 * Every 3D scene on the site asks this registry for a model by id, so
 * swapping or adding a vehicle is a data change, not a code change:
 *
 *   1. Drop the GLB into /public/models (Draco or Meshopt compressed).
 *   2. Add an entry below. `parts` maps our material slots to the mesh or
 *      node names inside the file (inspect with
 *      `npx @gltf-transform/cli inspect model.glb`).
 *   3. Point a vehicle's `modelId` at it (or change `HERO_MODEL_ID`).
 *
 * Normalisation (`scale`, `offset`, `rotationY`) should leave the car
 * with its wheels on y = 0, centred on x/z, nose pointing +z, and roughly
 * real-world size in metres — the camera rigs assume that.
 */

export interface VehicleModelParts {
  /** Painted body panels — receive the configurable clear-coat paint. */
  paint: string[];
  glass: string[];
  /** Rim meshes — receive the configurable wheel finish. */
  rims: string[];
  /** Bright trim/chrome — receives the rim finish at lower intensity. */
  trim?: string[];
  /** Front light emitters toggled by the lights control. */
  headlights?: string[];
  /** Rear light emitters. */
  taillights?: string[];
  /** Wheel nodes that spin when the car moves (rotate around local x). */
  wheels?: string[];
}

/** Recolours original materials by material name (e.g. to neutralise badges). */
export type MaterialOverrides = Record<
  string,
  {
    color: string;
    metalness?: number;
    roughness?: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    envMapIntensity?: number;
    /** Procedural / bundled surface detail. */
    texture?: "carbon" | "brushed" | "grain";
  }
>;

export interface VehicleModelDefinition {
  id: string;
  url: string;
  /** Needs the Draco decoder (served from /draco/). */
  draco: boolean;
  scale: number;
  offset: [number, number, number];
  rotationY: number;
  /** Real-world length in metres, used to frame cameras. */
  lengthM: number;
  heightM: number;
  /** Pre-baked contact shadow placed under the car. */
  shadowUrl?: string;
  shadowScale?: [number, number];
  parts: VehicleModelParts;
  materialOverrides?: MaterialOverrides;
  /** Local-space anchors (metres) used by inspection overlays. */
  anchors: Record<"frontWheel" | "rearWheel" | "headlight" | "cockpit" | "engine" | "vin" | "taillight", [number, number, number]>;
  credit?: { title: string; author: string; href: string; license: string };
}

export const vehicleModels: Record<string, VehicleModelDefinition> = {
  "studio-gt": {
    id: "studio-gt",
    url: "/models/studio-car.glb",
    draco: true,
    scale: 1,
    offset: [0, 0, 0],
    // The source file faces -Z; turn it so the nose points +Z.
    rotationY: Math.PI,
    lengthM: 4.53,
    heightM: 1.24,
    shadowUrl: "/models/studio-car-shadow.png",
    shadowScale: [0.655 * 4, 1.3 * 4],
    parts: {
      paint: ["body"],
      glass: ["glass"],
      rims: ["rim_fl", "rim_fr", "rim_rr", "rim_rl"],
      trim: ["trim"],
      headlights: ["lights", "leds"],
      taillights: ["brakes"],
      wheels: ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"],
    },
    // Brand badges and caps become quiet graphite — the site sells the
    // service, not the marque.
    materialOverrides: {
      Ferrari_Yellow: { color: "#1b1c1f", metalness: 0.8, roughness: 0.35 },
      metal_gray: { color: "#4a4c51", metalness: 1, roughness: 0.38, texture: "brushed" },
      metal_chrome: { color: "#e9eaec", metalness: 1, roughness: 0.05, envMapIntensity: 1.2 },
      Carbon_Fiber: { color: "#ffffff", metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05, texture: "carbon" },
      Tires: { color: "#121213", metalness: 0, roughness: 0.92, texture: "grain" },
      Leather: { color: "#2a2826", metalness: 0, roughness: 0.62, texture: "grain" },
      Interior_light: { color: "#6f6a63", roughness: 0.7, texture: "grain" },
      Interior_dark: { color: "#1f1f21", roughness: 0.75 },
      plastic_gray: { color: "#2b2c2f", roughness: 0.6 },
    },
    anchors: {
      frontWheel: [0.95, 0.36, 1.16],
      rearWheel: [0.95, 0.36, -1.5],
      headlight: [0.6, 0.62, 1.9],
      cockpit: [0.35, 0.85, 0.3],
      engine: [0, 1.0, -1.2],
      vin: [0.42, 0.86, 0.85],
      taillight: [0.62, 0.8, -2.05],
    },
    credit: {
      title: "Ferrari 458 Italia",
      author: "vicent091036",
      href: "https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6",
      license: "CC BY 4.0",
    },
  },
};

/** The car that stars in the homepage story. */
export const HERO_MODEL_ID = "studio-gt";

export function getVehicleModel(id: string | undefined): VehicleModelDefinition | undefined {
  return id ? vehicleModels[id] : undefined;
}

/* ── Configurator options ──────────────────────────────────────────── */

export interface PaintOption {
  id: string;
  name: string;
  color: string;
  metalness: number;
  roughness: number;
  clearcoatRoughness: number;
}

export const paintOptions: PaintOption[] = [
  { id: "obsidian", name: "Obsidian Black", color: "#07080a", metalness: 0.9, roughness: 0.42, clearcoatRoughness: 0.02 },
  { id: "graphite", name: "Liquid Graphite", color: "#3a3d42", metalness: 1, roughness: 0.38, clearcoatRoughness: 0.03 },
  { id: "chalk", name: "Chalk", color: "#c9c6bd", metalness: 0.2, roughness: 0.45, clearcoatRoughness: 0.04 },
  { id: "rosso", name: "Rosso Profondo", color: "#5e0a0c", metalness: 0.85, roughness: 0.35, clearcoatRoughness: 0.02 },
  { id: "verde", name: "British Racing Green", color: "#0d2a1f", metalness: 0.85, roughness: 0.4, clearcoatRoughness: 0.03 },
  { id: "azzurro", name: "Nocturne Blue", color: "#0f1f3d", metalness: 0.9, roughness: 0.36, clearcoatRoughness: 0.02 },
];

export interface WheelFinishOption {
  id: string;
  name: string;
  color: string;
  metalness: number;
  roughness: number;
}

export const wheelFinishOptions: WheelFinishOption[] = [
  { id: "satin-black", name: "Satin Black", color: "#101113", metalness: 0.6, roughness: 0.45 },
  { id: "polished", name: "Polished Alloy", color: "#d7d8da", metalness: 1, roughness: 0.14 },
  { id: "bronze", name: "Satin Bronze", color: "#6b5236", metalness: 1, roughness: 0.32 },
  { id: "titanium", name: "Titanium", color: "#5d6066", metalness: 1, roughness: 0.25 },
];

export type EnvironmentId = "studio" | "dusk" | "city" | "night";

export const environmentOptions: { id: EnvironmentId; name: string }[] = [
  { id: "studio", name: "Studio" },
  { id: "dusk", name: "Golden hour" },
  { id: "city", name: "City" },
  { id: "night", name: "Night" },
];

/** Which photographic backdrop each configurator environment uses. */
export const environmentBackdrop = {
  studio: "studio",
  dusk: "sunrise",
  city: "city",
  night: "night",
} as const;
