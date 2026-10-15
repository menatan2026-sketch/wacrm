/**
 * Ritmo motion presets — one source for web (Motion / Framer Motion) and mobile (Reanimated).
 * Mirrors the CSS tokens in tokens.css and the spec in docs/brand/MOTION.md.
 *
 * Web:    import { duration, ease, transition, variants } from "@ritmo/ui/motion";
 *         <motion.li variants={variants.listItem} />
 * Mobile: import { rn, rnTiming } from "@ritmo/ui/motion";
 *         withTiming(1, rnTiming("base"))  ·  withSpring(0, rn.spring.sheet)
 */

/** Durations in milliseconds. */
export const duration = {
  instant: 0,
  fast: 120, // hover, press, color changes
  base: 200, // toggles, tabs indicator, number changes, popovers
  moderate: 260, // list/row entrance, dialogs, toasts
  slow: 360, // sheets, page transitions, timeline growth
  deliberate: 600, // clock-in confirmation ring (once)
} as const;

/** Cubic-bezier control points. Enter = out, move = inOut, exit = in. Nothing bounces. */
export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  in: [0.55, 0, 1, 0.45] as const,
} as const;

export const stagger = 0.03; // seconds between list items; cap at 8 items
export const pressScale = 0.97;
export const offset = { xs: 4, sm: 8, md: 16 } as const; // px

const s = (ms: number) => ms / 1000;

/** Springs: only for direct manipulation (drag, sheets, layout reflow). Critically damped, no overshoot. */
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 44, mass: 1 }, // drop a dragged shift into its cell
  gentle: { type: "spring", stiffness: 280, damping: 34, mass: 1 }, // bottom sheets, layout reflow
  indicator: { type: "spring", stiffness: 420, damping: 40, mass: 0.8 }, // tab / segmented indicator (layoutId)
} as const;

/** Motion (Framer Motion) transitions. */
export const transition = {
  fast: { duration: s(duration.fast), ease: ease.out },
  base: { duration: s(duration.base), ease: ease.out },
  moderate: { duration: s(duration.moderate), ease: ease.out },
  slow: { duration: s(duration.slow), ease: ease.out },
  move: { duration: s(duration.base), ease: ease.inOut },
  exit: { duration: s(duration.fast), ease: ease.in },
} as const;

/** Reusable variants. Directional x offsets must be multiplied by `dir` (1 for LTR, -1 for RTL). */
export const variants = {
  enter: {
    hidden: { opacity: 0, y: offset.sm },
    show: { opacity: 1, y: 0, transition: transition.moderate },
    exit: { opacity: 0, y: offset.xs, transition: transition.exit },
  },
  list: {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: 0 } },
  },
  listItem: {
    hidden: { opacity: 0, y: offset.sm },
    show: { opacity: 1, y: 0, transition: transition.moderate },
  },
  pop: {
    hidden: { opacity: 0, scale: 0.96 },
    show: { opacity: 1, scale: 1, transition: transition.base },
    exit: { opacity: 0, scale: 0.98, transition: transition.exit },
  },
  dialog: {
    hidden: { opacity: 0, y: offset.sm, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: transition.moderate },
    exit: { opacity: 0, scale: 0.98, transition: transition.exit },
  },
  toast: {
    hidden: { opacity: 0, y: offset.md, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: transition.moderate },
    exit: { opacity: 0, y: offset.sm, transition: transition.exit },
  },
  /** Row leaving after an inline approve. Pass custom={dir}. */
  dismiss: {
    exit: (dir: 1 | -1) => ({ opacity: 0, x: 12 * dir, transition: transition.exit }),
  },
  /** Number changes: slide 6px in the direction of change; never count up. Pass custom={delta}. */
  number: {
    hidden: (delta: number) => ({ opacity: 0, y: delta >= 0 ? 6 : -6 }),
    show: { opacity: 1, y: 0, transition: transition.base },
  },
} as const;

/** Clock-in choreography (web). Total under 700ms; interruptible. */
export const clockIn = {
  press: { scale: pressScale, transition: transition.fast },
  fill: { transition: { duration: s(duration.base), ease: ease.inOut } }, // pulse -> beat background crossfade
  ring: { initial: { scale: 1, opacity: 0.55 }, animate: { scale: 1.7, opacity: 0 }, transition: { duration: s(duration.deliberate), ease: ease.out } },
  timer: { initial: { opacity: 0, y: offset.sm }, animate: { opacity: 1, y: 0 }, transition: { ...transition.moderate, delay: 0.08 } },
  haptic: "success" as const,
} as const;

/** React Native (Reanimated 3). */
export const rn = {
  /** Timing presets as data. Use `rnTiming("base")` to get a Reanimated config with the easing resolved. */
  timing: {
    fast: { duration: duration.fast, curve: ease.out },
    base: { duration: duration.base, curve: ease.out },
    moderate: { duration: duration.moderate, curve: ease.out },
    slow: { duration: duration.slow, curve: ease.out },
    move: { duration: duration.base, curve: ease.inOut },
    exit: { duration: duration.fast, curve: ease.in },
  },
  spring: {
    snappy: { stiffness: 520, damping: 44, mass: 1, overshootClamping: true },
    sheet: { stiffness: 280, damping: 34, mass: 1, overshootClamping: true },
    indicator: { stiffness: 420, damping: 40, mass: 0.8, overshootClamping: true },
  },
  /** expo-haptics mapping. */
  haptics: {
    toggle: "selection", // switches, segmented controls, day picker
    clockIn: "success", // clock in / clock out confirmed
    approve: "success",
    geofenceFail: "warning",
    error: "error",
    dragPickup: "impactLight",
    dragDrop: "impactMedium",
  },
} as const;

/** Reanimated timing config with the easing resolved lazily, so this file stays importable on the web. */
export function rnTiming(name: keyof typeof rn.timing) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Easing } = require("react-native-reanimated");
  const { duration: d, curve: c } = rn.timing[name];
  return { duration: d, easing: Easing.bezier(c[0], c[1], c[2], c[3]) };
}

/** Honour reduced motion everywhere: web `useReducedMotion()`, RN `useReducedMotion()` from Reanimated.
 *  When true: replace movement with an instant state change (opacity only, <=120ms), stop loops (live dot, shimmer),
 *  keep haptics. */
export const reducedMotion = {
  transition: { duration: 0.1, ease: "linear" },
} as const;
