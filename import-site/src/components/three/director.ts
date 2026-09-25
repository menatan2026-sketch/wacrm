/**
 * The director is the single source of truth shared by the DOM story and
 * the WebGL stage.
 *
 *  - Per-frame values (active chapter, progress, pointer) live on a plain
 *    mutable object: the render loop reads them without React re-renders.
 *  - User-facing settings (paint, wheels, environment, lights, hovered
 *    market) go through a tiny subscribable store so UI controls stay in
 *    sync with the scene.
 */
import { useSyncExternalStore } from "react";
import type { EnvironmentId } from "@/config/vehicle-models";

export type ChapterId = "hero" | "know" | "find" | "verify" | "bring" | "drive" | "final";

export const CHAPTERS: ChapterId[] = ["hero", "know", "find", "verify", "bring", "drive", "final"];

export type QualityTier = "high" | "medium" | "low";

/** Camera presets; "engine" / "frunk" frame an opened bay. */
export type StageView = "free" | "front" | "side" | "rear" | "top" | "cabin" | "starlight" | "engine" | "frunk";

export interface StageConfig {
  paint: string;
  wheel: string;
  interior: string;
  trim: string;
  caliper: string;
  env: EnvironmentId;
  lights: boolean;
  /** Fibre-optic starlight headliner. */
  starlight: boolean;
  /** Hinged parts opened from the configurator (or by clicking the car). */
  doors: boolean;
  hood: boolean;
  hatch: boolean;
  /** Camera preset requested from the configurator UI (consumed by the rig). */
  view: StageView;
  market: string | null;
  inspection: number;
}

export const director = {
  chapter: "hero" as ChapterId,
  progress: 0,
  /** 0→1 while the active chapter's section rises into the viewport. */
  enter: 1,
  /** True while any 3D chapter is on screen — the canvas pauses otherwise. */
  visible: true,
  pointer: { x: 0, y: 0 },
  /** Drag-to-rotate state for the configurator chapter. */
  drag: { yaw: 0, velocity: 0, active: false },
  quality: "high" as QualityTier,
  reducedMotion: false,
  /** Seconds since the car model finished loading (for the reveal). */
  loadedAt: -1,
  /** Hinged part under the pointer (drives the cursor label). */
  hoverPart: null as string | null,
};

const listeners = new Set<() => void>();
let config: StageConfig = {
  paint: "graphite",
  wheel: "satin-black",
  interior: "cuoio",
  trim: "carbon",
  caliper: "graphite",
  env: "studio",
  lights: false,
  starlight: true,
  doors: false,
  hood: false,
  hatch: false,
  view: "free",
  market: null,
  inspection: 0,
};

export function getStageConfig() {
  return config;
}

export function setStageConfig(patch: Partial<StageConfig>) {
  const next = { ...config, ...patch };
  if ((Object.keys(patch) as (keyof StageConfig)[]).every((k) => next[k] === config[k])) return;
  config = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStageConfig<T>(select: (c: StageConfig) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(config),
    () => select(config),
  );
}

/* ── HUD anchors: DOM elements positioned from 3D points ──────────── */

export type HudAnchor = {
  el: HTMLElement;
  /** Anchor id in the model registry, or a market code prefixed with "market:". */
  key: string;
};

export const hudAnchors = new Map<string, HudAnchor>();

export function registerHud(id: string, anchor: HudAnchor) {
  hudAnchors.set(id, anchor);
  return () => {
    if (hudAnchors.get(id) === anchor) hudAnchors.delete(id);
  };
}
