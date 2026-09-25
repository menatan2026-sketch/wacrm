/**
 * Story choreography. Each chapter maps its scroll progress (0→1) to a
 * Pose: camera, lighting, globe zoom, car motion and effects. The rig
 * damps the live scene toward the pose every frame, so scroll feels
 * weighted rather than scrubbed.
 *
 * Contiguous chapters share boundary poses (hero end = know start,
 * find end = verify start), which is what makes the story read as one
 * continuous shot.
 */
import type { ChapterId, StageView } from "./director";
import type { BackdropId } from "@/config/environments";
import type { PaletteId } from "./DynamicEnvironment";

export interface Pose {
  az: number;
  el: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
  /** Screen-space framing: +x moves the subject left, +y moves it up. */
  shiftX: number;
  shiftY: number;
  fov: number;
  /** Globe zoom: 0 = studio, 1 = full planet. */
  zoom: number;
  globeDraw: number;
  globeSpin: number;
  /** Target lighting palette — the environment glides to it over time. */
  palette: PaletteId;
  /** Photographic backdrop ("none" = procedural studio / void). */
  backdrop: BackdropId | "none";
  envGain: number;
  glow: number;
  horizon: number;
  floor: number;
  dust: number;
  flow: number;
  speed: number;
  headlights: number;
  taillights: number;
  carZ: number;
  carYaw: number;
  container: number;
  containerOpacity: number;
  gate: number;
  scanner: number;
  plate: number;
  ring: number;
  road: number;
  fade: number;
  fogNear: number;
  fogFar: number;
  /** Hinged parts the story opens (0 closed → 1 open). */
  doors: number;
  hood: number;
  hatch: number;
  /** Front-wheel steer, radians. */
  steer: number;
}

type NumericKey = { [K in keyof Pose]: Pose[K] extends number ? K : never }[keyof Pose];

export const BASE_POSE: Pose = {
  az: 0.78,
  el: 0.1,
  dist: 8.2,
  tx: 0,
  ty: 0.55,
  tz: 0,
  shiftX: 0,
  shiftY: 0,
  fov: 30,
  zoom: 0,
  globeDraw: 0,
  globeSpin: 0,
  palette: "studio",
  backdrop: "studio",
  envGain: 1,
  glow: 0.7,
  horizon: 0,
  floor: 1,
  dust: 1,
  flow: 0,
  speed: 0,
  headlights: 0,
  taillights: 0,
  carZ: 0,
  carYaw: 0,
  container: 0,
  containerOpacity: 0,
  gate: -1,
  scanner: -1,
  plate: 0,
  ring: 0,
  road: 0,
  fade: 0,
  fogNear: 18,
  fogFar: 60,
  doors: 0,
  hood: 0,
  hatch: 0,
  steer: 0,
};

export const NUMERIC_KEYS = (Object.keys(BASE_POSE) as (keyof Pose)[]).filter(
  (k) => typeof BASE_POSE[k] === "number",
) as NumericKey[];

type Key = [at: number, pose: Partial<Pose>];

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Interpolates keyframes; the palette snaps at the midpoint (the environment smooths it). */
function track(p: number, keys: Key[], base: Pose = BASE_POSE): Pose {
  // Resolve each key against the previous so keys only list what changes.
  const resolved: [number, Pose][] = [];
  let prev = base;
  for (const [at, partial] of keys) {
    prev = { ...prev, ...partial };
    resolved.push([at, prev]);
  }
  if (p <= resolved[0][0]) return { ...resolved[0][1] };
  for (let i = 0; i < resolved.length - 1; i++) {
    const [a, pa] = resolved[i];
    const [b, pb] = resolved[i + 1];
    if (p <= b) {
      const t = smooth(clamp01((p - a) / (b - a)));
      const out = { ...(t < 0.5 ? pa : pb) };
      for (const k of NUMERIC_KEYS) (out[k] as number) = (pa[k] as number) + ((pb[k] as number) - (pa[k] as number)) * t;
      return out;
    }
  }
  return { ...resolved[resolved.length - 1][1] };
}

const GLOBE: Partial<Pose> = {
  zoom: 1,
  az: 0,
  el: 1.3,
  dist: 12.5,
  tx: 0,
  ty: -2.2,
  tz: 0,
  palette: "void",
  backdrop: "none",
  envGain: 0.5,
  glow: 0.15,
  floor: 0,
  dust: 0.25,
  fogNear: 30,
  fogFar: 120,
};

type Vec3 = [number, number, number];

export interface PoseContext {
  tall: boolean;
  /** Configurator overrides (know chapter). */
  env: "studio" | "dusk" | "city" | "night";
  lights: boolean;
  view: StageView;
  /** Car-space anchors of the hero model (inspection close-ups). */
  anchors: Record<"frontWheel" | "headlight" | "cockpit" | "vin" | "engine" | "hood", Vec3>;
  /** Cabin camera (car space) and the car's current yaw, for the interior view. */
  cabin?: { eye: Vec3; target: Vec3 };
  starlightView?: { eye: Vec3; target: Vec3 };
  yaw: number;
}

/** Orbit parameters that put the camera at `eye` looking at `target`. */
function lookFrom(eye: Vec3, target: Vec3, yaw: number): Partial<Pose> {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const rot = ([x, y, z]: Vec3): Vec3 => [x * c + z * s, y, -x * s + z * c];
  const e = rot(eye);
  const t = rot(target);
  const dx = e[0] - t[0];
  const dy = e[1] - t[1];
  const dz = e[2] - t[2];
  const dist = Math.hypot(dx, dy, dz);
  return { tx: t[0], ty: t[1], tz: t[2], dist, el: Math.asin(dy / dist), az: Math.atan2(dx, dz) };
}

/** Camera target on an anchor, for the inspection close-ups. */
const at = (a: Vec3): Partial<Pose> => ({ tx: a[0], ty: a[1], tz: a[2] });

export function chapterPose(chapter: ChapterId, p: number, ctx: PoseContext): Pose {
  let pose: Pose;
  switch (chapter) {
    case "hero":
      pose = track(p, [
        [0, { az: 0.82, el: 0.1, dist: 9.6, shiftX: -0.2, shiftY: 0.2, ty: 0.5, envGain: 1.3, glow: 1, steer: 0.24 }],
        [1, { az: 0.42, el: 0.06, dist: 7.6, shiftX: 0.1, ty: 0.5, steer: 0 }],
      ]);
      break;

    case "know": {
      const envKey = ctx.env;
      pose = track(p, [
        [
          0,
          {
            az: 0.42,
            el: 0.06,
            dist: 8,
            shiftX: 0.24,
            shiftY: -0.1,
            ty: 0.5,
            palette: envKey === "city" ? "studio" : envKey,
            backdrop: ({ studio: "studio", dusk: "sunrise", city: "city", night: "night" } as const)[envKey],
          },
        ],
        [0.5, { az: 1.5, el: 0.05, dist: 8.6 }],
        [1, { az: 2.45, el: 0.13, dist: 8.2 }],
      ]);
      if (ctx.view === "starlight" && ctx.starlightView) {
        // Lean back in the rear seat and look up at the stars.
        Object.assign(pose, lookFrom(ctx.starlightView.eye, ctx.starlightView.target, ctx.yaw), { fov: 72, shiftX: 0.14, shiftY: 0, dust: 0 });
      } else if (ctx.view === "cabin" && ctx.cabin) {
        Object.assign(pose, lookFrom(ctx.cabin.eye, ctx.cabin.target, ctx.yaw), { fov: 58, shiftX: 0.12, shiftY: 0, dust: 0 });
      } else if (ctx.view === "engine" || ctx.view === "frunk") {
        // Frame the opened bay from high on the side (the rear clamshell
        // hinges at the tail, so the engine reads from the side / front).
        const a = ctx.view === "engine" ? ctx.anchors.engine : ctx.anchors.hood;
        const [ax, ay, az] = a;
        const c = Math.cos(ctx.yaw);
        const sn = Math.sin(ctx.yaw);
        const engine = ctx.view === "engine";
        Object.assign(pose, { tx: ax * c + az * sn, ty: ay, tz: -ax * sn + az * c, dist: engine ? 3.7 : 4.2, el: engine ? 1.05 : 0.8, az: ctx.yaw + (engine ? 1.75 : 0.55), shiftY: -0.04 });
      } else if (ctx.view === "front" || ctx.view === "side" || ctx.view === "rear" || ctx.view === "top") {
        const v = { front: [0.001, 0.05, 8], side: [Math.PI / 2, 0.04, 8.6], rear: [Math.PI - 0.001, 0.08, 8], top: [0.6, 1.25, 9.5] }[ctx.view];
        pose.az = v[0];
        pose.el = v[1];
        pose.dist = v[2];
      }
      if (envKey === "dusk") Object.assign(pose, { horizon: 0.9, glow: 0.35 });
      if (envKey === "night") Object.assign(pose, { glow: 0.25, dust: 0.5 });
      pose.headlights = ctx.lights ? 1 : 0;
      pose.taillights = ctx.lights ? 0.8 : 0;
      break;
    }

    case "find":
      pose = track(p, [
        [0, { az: 0.2, el: 1.15, dist: 9, ty: 0, shiftX: 0 }],
        [0.08, { az: 0.15, el: 1.25, dist: 8.2 }],
        [0.42, { ...GLOBE, shiftX: -0.2, globeDraw: 0, globeSpin: 0 }],
        [0.85, { globeDraw: 1, globeSpin: 0.35 }],
        [1, { globeDraw: 1, globeSpin: 0.45 }],
      ]);
      break;

    case "verify": {
      const A = ctx.anchors;
      pose = track(p, [
        [0, { ...GLOBE, shiftX: -0.2, globeDraw: 1, globeSpin: 0.45 }],
        // Mechanical: front wheel turned out so tread, disc and caliper read.
        [0.2, { zoom: 0, az: 1.05, el: 0.04, dist: 3.4, ...at(A.frontWheel), shiftX: -0.16, palette: "inspect", backdrop: "studio", envGain: 1, glow: 0.5, floor: 1, dust: 0.6, fogNear: 18, fogFar: 60, globeDraw: 1, steer: 0.42 }],
        [0.3, { az: 1.25, dist: 3.0 }],
        // Paintwork: along the front wing to the headlight.
        [0.38, { az: 0.5, el: 0.16, dist: 3.3, ...at(A.headlight), steer: 0 }],
        [0.46, { az: 0.62, dist: 3.1 }],
        // Mileage: doors rise, the camera looks down into the cabin.
        [0.54, { az: 1.1, el: 0.62, dist: 3.1, ...at(A.cockpit), doors: 1 }],
        [0.62, { az: 1.25, dist: 2.9 }],
        // Documents: VIN plate at the base of the windscreen.
        [0.7, { az: 0.95, el: 0.42, dist: 3.1, ...at(A.vin), shiftX: -0.16, doors: 0 }],
        [0.77, { az: 1.1, dist: 2.9 }],
        // Service history: the rear clamshell rises over the engine.
        [0.85, { az: 1.6, el: 1.02, dist: 3.8, ...at(A.engine), shiftX: -0.16, hatch: 1 }],
        [0.9, { az: 1.85, dist: 3.5, scanner: -1 }],
        [0.92, { scanner: 0 }],
        [1, { az: 2.1, el: 0.16, dist: 8.8, tx: 0, ty: 0.5, tz: 0, shiftX: 0, scanner: 1, hatch: 0 }],
      ]);
      break;
    }

    case "bring": {
      // Eight journey steps across the chapter.
      const s = (i: number, f = 0) => (i + f) / 8;
      pose = track(p, [
        [0, { az: 0.6, el: 0.12, dist: 11.2, shiftX: -0.2, shiftY: 0.18, palette: "studio", envGain: 0.85 }],
        [s(1), { az: 0.9, el: 0.22, dist: 10.2 }],
        [s(2), { az: 1.35, el: 0.18, dist: 9.2, shiftX: 0, scanner: 0, palette: "inspect" }],
        [s(3), { az: 1.55, scanner: 1 }],
        [s(3, 0.3), { az: 0.35, el: 0.1, dist: 8.4, scanner: 1.2, palette: "studio", ring: 1 }],
        [s(4), { az: 0.5, ring: 0.6 }],
        [s(4, 0.1), { az: 1.2, el: 0.14, dist: 13, ring: 0, container: 0, containerOpacity: 1, palette: "transit", backdrop: "none", glow: 0.25 }],
        [s(4, 0.55), { az: 1.5, el: 0.08, dist: 13.5, container: 1, speed: 0, flow: 0 }],
        [s(5), { az: 1.62, speed: 1, flow: 1, dust: 1.4 }],
        [s(5, 0.15), { az: 1.1, el: 0.12, dist: 9.6, containerOpacity: 0, speed: 0, flow: 0, dust: 0.8, gate: 0, palette: "night", glow: 0.3 }],
        [s(6), { az: 0.9, gate: 1 }],
        [s(6, 0.15), { az: 2.75, el: 0.05, dist: 5.6, tx: 0, ty: 0.5, tz: -1.4, gate: 1.2, plate: 0, palette: "studio", backdrop: "studio", glow: 0.6 }],
        [s(6, 0.45), { plate: 1, az: 2.9, dist: 5.2, taillights: 0.8 }],
        [s(7), { az: 2.95 }],
        [s(7, 0.2), { az: 0.55, el: 0.03, dist: 7.4, tx: 0, ty: 0.5, tz: 0, palette: "dawn", backdrop: "sunrise", horizon: 0.6, taillights: 0, headlights: 0 }],
        [1, { az: 0.3, dist: 7.0, headlights: 1 }],
      ]);
      pose.plate = Math.max(pose.plate, p > s(6, 0.4) ? 1 : 0);
      break;
    }

    case "drive":
      pose = track(p, [
        [0, { az: 0.95, el: 0.05, dist: 8.6, shiftX: -0.2, shiftY: 0.2, palette: "dusk", backdrop: "sunrise", headlights: 1, taillights: 0.7, horizon: 1, glow: 0.3, dust: 0.6, plate: 1, steer: 0.26 }],
        [1, { az: 0.38, el: 0.07, dist: 6.9 }],
      ]);
      break;

    case "final":
      pose = track(p, [
        [0, { az: 0, el: 0.035, dist: 9.5, tx: 0, ty: 0.62, tz: 0, carZ: -48, headlights: 1, palette: "night", backdrop: "none", envGain: 0.7, glow: 0.12, road: 1, dust: 0.4, fogNear: 6, fogFar: 42, plate: 1 }],
        [0.62, { carZ: -3.2 }],
        [0.74, { carZ: 1.2, el: 0.02, fade: 0.25 }],
        [0.9, { fade: 1, carZ: 1.6 }],
        [1, { fade: 1, carZ: 1.6 }],
      ]);
      break;
  }

  if (ctx.tall) {
    // Portrait framing: pull back so the car fits the width, keep it in
    // the upper half, never offset sideways.
    const carShot = 1 - pose.zoom;
    // Close-ups (verify) need less pull-back than full-car shots.
    const closeUp = pose.dist < 5 ? 0.45 : 1;
    pose.dist *= 1 + carShot * 0.95 * closeUp + pose.zoom * 0.75;
    pose.shiftX = 0;
    pose.shiftY = chapter === "final" ? 0 : chapter === "bring" ? 0.2 : chapter === "hero" ? 0.34 : 0.16;
    pose.fov = 34;
  }
  return pose;
}
