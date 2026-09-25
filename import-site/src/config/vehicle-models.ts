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
  /** Wheel nodes that spin when the car moves (around the car's lateral axis). */
  wheels?: string[];
  /** Front wheel nodes, steered around the car's vertical axis. */
  steer?: string[];
  /** Steering wheel node (turns with the front wheels). */
  steeringWheel?: string;
}

/**
 * Shared, configurable materials a mesh can be bound to. Binding is by
 * the material *name* inside the GLB (`materialSlots`) or, for one-off
 * parts, by node name (`nodeSlots`). The original material's texture maps
 * (baked AO, tread/sidewall normals…) are adopted by the slot material.
 */
export type MaterialSlot =
  | "paint"
  | "accentPaint"
  | "glass"
  | "rims"
  | "rimAccent"
  | "headlights"
  | "taillights"
  | "signals"
  | "leather"
  | "leatherAccent"
  | "seatInsert"
  | "carpet"
  | "dashboard"
  | "trim"
  | "hardware"
  | "mechanical"
  | "rubber"
  | "tireSide"
  | "tireTread"
  | "caliper"
  | "disc"
  | "mirror"
  | "grille"
  | "plate";

/** A hinged part (door, hood, hatch) the visitor can open. */
export interface OpenableDef {
  id: "doorL" | "doorR" | "hood" | "hatch";
  node: string;
  /** Hinge axis in the node's parent space (normalised on load). */
  axis: [number, number, number];
  /** Fully open angle, radians. */
  angle: number;
  /** Optional second rotation (e.g. a butterfly door's outward swing). */
  swing?: { axis: [number, number, number]; angle: number };
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
  widthM: number;
  /** Pre-baked contact shadow placed under the car (else a soft procedural one). */
  shadowUrl?: string;
  shadowScale?: [number, number];
  parts: VehicleModelParts;
  materialSlots?: Record<string, MaterialSlot>;
  nodeSlots?: Record<string, MaterialSlot>;
  /** UV density per slot (metres per UV unit), so procedural maps land at true scale. */
  uvMetres?: Partial<Record<MaterialSlot, number>>;
  openables?: OpenableDef[];
  /** Nodes hidden on load (placeholders, logos). */
  hide?: string[];
  materialOverrides?: MaterialOverrides;
  /** Local-space anchors (metres) used by inspection overlays and hotspots. */
  anchors: Record<
    "frontWheel" | "rearWheel" | "headlight" | "cockpit" | "engine" | "vin" | "taillight" | "door" | "hood" | "hatch",
    [number, number, number]
  >;
  /** Camera for the "cabin" view: eye position and look-at target (car space). */
  cabin?: { eye: [number, number, number]; target: [number, number, number] };
  /** Where the procedural engine sits (car space), if the bay is empty. */
  engineBay?: { position: [number, number, number]; scale: number; rotationY?: number };
  /** Starlight headliner: centre (car space), size (w, d), downward sag at the edges, star count. */
  starlight?: { center: [number, number, number]; size: [number, number]; sag: number; count: number };
  /** Camera for looking up at the headliner (car space). */
  starlightView?: { eye: [number, number, number]; target: [number, number, number] };
  /** Carpeted luggage tub under the bonnet (car space; size = w, h, d). */
  frunk?: { position: [number, number, number]; size: [number, number, number] };
  /** Showcase copy for the homepage configurator. */
  showcase?: { name: string; subtitle: string; spec: [string, string][] };
  credit?: { title: string; author: string; href: string; license: string };
}

export const vehicleModels: Record<string, VehicleModelDefinition> = {
  "concept-gt": {
    id: "concept-gt",
    url: "/models/concept-car.glb",
    draco: true,
    scale: 1,
    offset: [0, 0, 0],
    rotationY: 0,
    lengthM: 4.45,
    heightM: 1.2,
    widthM: 2.05,
    parts: {
      paint: [],
      glass: [],
      rims: [],
      wheels: ["WheelFrontL", "WheelFrontR", "WheelRearL", "WheelRearR"],
      steer: ["WheelFrontL", "WheelFrontR"],
      steeringWheel: "InteriorSteeringCylinder",
    },
    materialSlots: {
      "Paint 1 Carmine": "paint",
      "Paint 2 Carmine": "accentPaint",
      Glass: "glass",
      Rim1: "rims",
      Rim2: "rimAccent",
      Headlight: "headlights",
      Brakelight: "taillights",
      Signallight: "signals",
      "Interior 3 Carmine": "leather",
      "Interior 1": "leatherAccent",
      "Panel Sides": "leatherAccent",
      "Interior 2": "seatInsert",
      Floormat: "carpet",
      Dashboard: "dashboard",
      Hardware: "hardware",
      Mechanical: "mechanical",
      "": "rubber",
      Tireside: "tireSide",
      Tiretread: "tireTread",
      Brake: "caliper",
      Disc: "disc",
      Mirror: "mirror",
      License: "plate",
    },
    // Measured from the mesh: world edge length / UV edge length.
    uvMetres: {
      leather: 3.2,
      leatherAccent: 3.2,
      seatInsert: 3.2,
      carpet: 0.365,
      trim: 3.0,
      grille: 4.56,
    },
    nodeSlots: {
      BodyHoodTopgrill: "grille",
      InteriorDashSides: "trim",
      InteriorSteeringWheel02: "trim",
      InteriorPillar: "leatherAccent",
    },
    // Hinges are in the model's own Z-up frame: +X = car's left, -Y = forward.
    openables: [
      { id: "doorL", node: "BodyDoorLColor1", axis: [1, 0, 0], angle: 1.05, swing: { axis: [0, 1, 0], angle: -0.32 } },
      { id: "doorR", node: "BodyDoorRColor1", axis: [1, 0, 0], angle: 1.05, swing: { axis: [0, 1, 0], angle: 0.32 } },
      { id: "hood", node: "BodyHood", axis: [1, 0, 0], angle: 0.95 },
      { id: "hatch", node: "BodyRearPanelsColor1", axis: [1, 0, 0], angle: -1.15 },
    ],
    hide: ["Engine"],
    anchors: {
      frontWheel: [0.98, 0.38, 1.49],
      rearWheel: [0.98, 0.38, -1.31],
      headlight: [0.7, 0.66, 2.18],
      cockpit: [0, 0.78, 0.55],
      engine: [0, 0.62, -1.62],
      vin: [0.42, 0.84, 1.62],
      taillight: [0.62, 0.96, -1.58],
      door: [1.05, 0.72, 0.32],
      hood: [0, 0.84, 1.85],
      hatch: [0, 1.08, -1.05],
    },
    // Central driving position: the eye sits on the car's centre line.
    cabin: { eye: [0, 0.97, 0.42], target: [0, 0.66, 2.3] },
    // Behind the +2 seats, under the rear clamshell (visible through the glass).
    engineBay: { position: [0, 0.2, -1.63], scale: 1 },
    frunk: { position: [0, 0.16, 2.06], size: [1.08, 0.44, 0.5] },
    // Under the roof, over both rows (the glass roof is lined from inside).
    starlight: { center: [0, 1.095, -0.16], size: [1.22, 1.42], sag: 0.035, count: 1600 },
    starlightView: { eye: [0, 0.8, -0.95], target: [0, 1.08, 0.2] },
    showcase: {
      name: "Studio GT",
      subtitle: "Concept · 2+2 coupé",
      spec: [
        ["Layout", "Rear-mid engine, 2+2"],
        ["Engine", "4.0 V8 twin-turbo (study)"],
        ["Power", "650 hp"],
        ["0–100 km/h", "3.1 s"],
        ["Doors", "Dihedral, carbon tub"],
        ["Length", "4.45 m"],
      ],
    },
    credit: {
      title: "Car Concept",
      author: "Eric Chadwick / DGG, after Unity Fan (CC0)",
      href: "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept",
      license: "CC BY 4.0",
    },
  },
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
    widthM: 1.94,
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
    materialSlots: {
      Leather: "leather",
      Interior_light: "leatherAccent",
      Interior_dark: "carpet",
      Carbon_Fiber: "trim",
      Tires: "tireTread",
    },
    uvMetres: { trim: 0.061 },
    // Brand badges and caps become quiet graphite — the site sells the
    // service, not the marque.
    materialOverrides: {
      Ferrari_Yellow: { color: "#1b1c1f", metalness: 0.8, roughness: 0.35 },
      metal_gray: { color: "#4a4c51", metalness: 1, roughness: 0.38, texture: "brushed" },
      metal_chrome: { color: "#e9eaec", metalness: 1, roughness: 0.05, envMapIntensity: 1.2 },
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
      door: [0.95, 0.75, 0.2],
      hood: [0, 0.8, 1.5],
      hatch: [0, 1.0, -1.3],
    },
    cabin: { eye: [-0.36, 0.95, -0.2], target: [-0.1, 0.78, 1.6] },
    credit: {
      title: "Ferrari 458 Italia",
      author: "vicent091036",
      href: "https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6",
      license: "CC BY 4.0",
    },
  },
};

/** The car that stars in the homepage story. */
export const HERO_MODEL_ID = "concept-gt";

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

/** Cabin hide: main leather, contrast accent, stitching and headliner. */
export interface InteriorOption {
  id: string;
  name: string;
  leather: string;
  accent: string;
  stitch: string;
  /** Seat centre inserts (perforated / Alcantara). */
  insert: string;
  carpet: string;
}

export const interiorOptions: InteriorOption[] = [
  { id: "nero", name: "Nero", leather: "#121212", accent: "#1b1b1c", stitch: "#8d8d8d", insert: "#0e0e0f", carpet: "#101011" },
  { id: "cuoio", name: "Cuoio", leather: "#5b3219", accent: "#141110", stitch: "#e2cfae", insert: "#6a3b1e", carpet: "#151211" },
  { id: "rosso", name: "Rosso", leather: "#4d0a0c", accent: "#121213", stitch: "#e8dcd5", insert: "#161616", carpet: "#121213" },
  { id: "bianco", name: "Ghiaccio", leather: "#cfc8bb", accent: "#1b1b1c", stitch: "#2a2a2a", insert: "#b9b2a5", carpet: "#1a1a1b" },
  { id: "blu", name: "Blu Notte", leather: "#141d33", accent: "#0f0f11", stitch: "#b9c4dc", insert: "#1a2540", carpet: "#0f1016" },
];

export interface TrimOption {
  id: "carbon" | "aluminium" | "piano" | "walnut";
  name: string;
}

export const trimOptions: TrimOption[] = [
  { id: "carbon", name: "Carbon" },
  { id: "aluminium", name: "Brushed alloy" },
  { id: "piano", name: "Piano black" },
  { id: "walnut", name: "Open-pore walnut" },
];

export interface CaliperOption {
  id: string;
  name: string;
  color: string;
}

export const caliperOptions: CaliperOption[] = [
  { id: "graphite", name: "Graphite", color: "#26272a" },
  { id: "rosso", name: "Rosso", color: "#8a0c0f" },
  { id: "giallo", name: "Giallo", color: "#c99a06" },
  { id: "blu", name: "Blu", color: "#123a86" },
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
