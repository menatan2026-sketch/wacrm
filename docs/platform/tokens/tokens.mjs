// Design tokens: single source of truth.
// `node build.mjs` emits tokens.css (Tailwind v4), tokens.json (W3C DTCG)
// and tokens.native.json (hex, for React Native), and fails the build
// if any pair in `contrastPairs` misses its WCAG target in either theme.
//
// Becomes `packages/tokens` once the monorepo exists.

// ---------------------------------------------------------------------------
// 1. Color primitives: OKLCH scales generated from (hue, max chroma).
//    Lightness is fixed per step, so every hue's "600" has the same
//    perceived weight. That is what keeps the categorical shift
//    palette balanced. Chroma is clamped to sRGB in build.mjs.
// ---------------------------------------------------------------------------
export const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
export const stepLightness = {
  50: 0.975,
  100: 0.948,
  200: 0.9,
  300: 0.83,
  400: 0.74,
  500: 0.64,
  600: 0.555,
  700: 0.48,
  800: 0.4,
  900: 0.32,
  950: 0.25,
};
export const stepChroma = {
  50: 0.12,
  100: 0.25,
  200: 0.45,
  300: 0.65,
  400: 0.85,
  500: 0.97,
  600: 1,
  700: 0.94,
  800: 0.84,
  900: 0.7,
  950: 0.55,
};

// Brand + categorical hues. `iris` is the brand accent: a calm
// blue-violet chosen to read as "premium tool" (Linear/Stripe family)
// without copying either.
export const hues = {
  iris: { h: 277, c: 0.21 },
  blue: { h: 250, c: 0.18 },
  sky: { h: 228, c: 0.14 },
  teal: { h: 190, c: 0.12 },
  green: { h: 152, c: 0.16 },
  lime: { h: 128, c: 0.17 },
  amber: { h: 78, c: 0.17 },
  orange: { h: 50, c: 0.18 },
  red: { h: 25, c: 0.2 },
  magenta: { h: 342, c: 0.2 },
};

// Neutrals: cool, very low chroma; extra steps at both ends for app
// backgrounds and dark surfaces.
export const neutral = {
  h: 265,
  scale: {
    0: [1, 0],
    25: [0.99, 0.002],
    50: [0.976, 0.003],
    100: [0.955, 0.005],
    200: [0.918, 0.007],
    300: [0.868, 0.009],
    400: [0.72, 0.012],
    450: [0.625, 0.013],
    500: [0.552, 0.014],
    600: [0.47, 0.014],
    700: [0.385, 0.012],
    800: [0.3, 0.01],
    850: [0.25, 0.009],
    900: [0.215, 0.008],
    950: [0.182, 0.007],
    1000: [0.152, 0.006],
  },
};

// ---------------------------------------------------------------------------
// 2. Semantic color tokens. Values reference primitives as
//    "<palette>.<step>" or are literal CSS. Components use ONLY these.
// ---------------------------------------------------------------------------
const status = (
  hue,
  {
    solidLight = 600,
    solidDark = 600,
    onSolidLight = 'white',
    onSolidDark = 'white',
  } = {}
) => ({
  light: {
    solid: `${hue}.${solidLight}`,
    'on-solid': onSolidLight,
    soft: `${hue}.50`,
    'on-soft': `${hue}.800`,
    border: `${hue}.200`,
    fg: `${hue}.700`,
  },
  dark: {
    solid: `${hue}.${solidDark}`,
    'on-solid': onSolidDark,
    soft: `${hue}.950`,
    'on-soft': `${hue}.200`,
    border: `${hue}.800`,
    fg: `${hue}.300`,
  },
});

export const semantic = {
  light: {
    background: 'neutral.25', // app canvas
    surface: 'neutral.0', // cards, panels
    'surface-raised': 'neutral.0', // popovers, menus (+ shadow)
    'surface-sunken': 'neutral.50', // wells, table headers, inputs on cards
    'surface-hover': 'neutral.100',
    'surface-selected': 'iris.50',
    foreground: 'neutral.950',
    'foreground-muted': 'neutral.600',
    'foreground-subtle': 'neutral.500',
    'foreground-disabled': 'neutral.400',
    border: 'neutral.200',
    'border-strong': 'neutral.300',
    'border-input': 'neutral.500',
    primary: 'iris.600',
    'primary-hover': 'iris.700',
    'on-primary': 'white',
    'primary-soft': 'iris.50',
    'on-primary-soft': 'iris.700',
    ring: 'iris.500',
    link: 'iris.700',
    overlay: 'oklch(0.18 0.01 265 / 0.45)',
  },
  dark: {
    background: 'neutral.1000',
    surface: 'neutral.950',
    'surface-raised': 'neutral.900',
    'surface-sunken': 'neutral.1000',
    'surface-hover': 'neutral.850',
    'surface-selected': 'iris.950',
    foreground: 'neutral.50',
    'foreground-muted': 'neutral.400',
    'foreground-subtle': 'neutral.450',
    'foreground-disabled': 'neutral.700',
    border: 'neutral.850',
    'border-strong': 'neutral.800',
    'border-input': 'neutral.500',
    primary: 'iris.600',
    'primary-hover': 'iris.700',
    'on-primary': 'white',
    'primary-soft': 'iris.950',
    'on-primary-soft': 'iris.200',
    ring: 'iris.400',
    link: 'iris.300',
    overlay: 'oklch(0 0 0 / 0.6)',
  },
  status: {
    success: status('green', { solidLight: 700, solidDark: 700 }),
    warning: status('amber', {
      solidLight: 400,
      solidDark: 400,
      onSolidLight: 'neutral.1000',
      onSolidDark: 'neutral.1000',
    }),
    danger: status('red'),
    info: status('blue'),
  },
  // Domain tokens: attendance states. Each state has a dot (3:1 vs
  // surface) and a soft badge (bg + AA text).
  attendance: {
    'on-shift': 'green',
    'on-break': 'amber',
    late: 'orange',
    absent: 'red',
    scheduled: 'blue',
    overtime: 'magenta',
    off: 'neutral',
  },
  // Productivity categories are deliberately NOT red/green: the framing
  // is self-improvement, not punishment. "Unproductive" is a calm amber.
  activity: {
    productive: 'teal',
    neutral: 'neutral',
    unproductive: 'amber',
    idle: 'neutral',
  },
  // Position colors on schedule chips: 10 hues of equal perceived weight.
  shift: [
    'iris',
    'blue',
    'sky',
    'teal',
    'green',
    'lime',
    'amber',
    'orange',
    'red',
    'magenta',
  ],
  // Chart series order (max 8 per chart; beyond that, group "Other").
  chart: ['iris', 'teal', 'amber', 'magenta', 'sky', 'lime', 'orange', 'blue'],
};

// Contrast contracts checked by build.mjs, for both themes.
// [foreground token, background token, minimum ratio]
//   4.5 = WCAG 1.4.3 body text · 3 = 1.4.11 UI components / large text
export const contrastPairs = [
  ['foreground', 'background', 4.5],
  ['foreground', 'surface', 4.5],
  ['foreground', 'surface-sunken', 4.5],
  ['foreground-muted', 'background', 4.5],
  ['foreground-muted', 'surface', 4.5],
  ['foreground-muted', 'surface-sunken', 4.5],
  ['foreground-muted', 'surface-hover', 4.5],
  ['foreground-subtle', 'surface', 4.5],
  ['foreground-subtle', 'background', 4.5],
  ['border-input', 'surface', 3],
  ['border-input', 'background', 3],
  ['on-primary', 'primary', 4.5],
  ['on-primary', 'primary-hover', 4.5],
  ['on-primary-soft', 'primary-soft', 4.5],
  ['primary', 'surface', 3],
  ['primary', 'background', 3],
  ['ring', 'surface', 3],
  ['ring', 'background', 3],
  ['link', 'surface', 4.5],
  ['link', 'background', 4.5],
  ['foreground', 'surface-selected', 4.5],
];

// ---------------------------------------------------------------------------
// 3. Typography
// ---------------------------------------------------------------------------
export const font = {
  // Inter has no Hebrew glyphs, so the browser falls through to Heebo
  // for Hebrew characters automatically, while Latin words and numbers
  // inside Hebrew text stay in Inter. One stack, both scripts.
  sans: '"Inter Variable", "Inter", "Heebo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  // Tabular figures everywhere numbers align (timesheets, clocks, money).
  numeric: '"tnum" 1, "cv11" 1',
};

// [font-size rem, line-height rem, letter-spacing (Latin only), weight]
export const type = {
  '2xs': [0.6875, 1, '0.01em', 500], // 11px: badges, eyebrow labels only
  xs: [0.75, 1.125, '0', 400], // 12px
  sm: [0.8125, 1.25, '0', 400], // 13px: dense tables, secondary
  base: [0.875, 1.375, '-0.003em', 400], // 14px: web app body (desktop density)
  md: [1, 1.5, '-0.006em', 400], // 16px: mobile body; inputs on touch (no iOS zoom)
  lg: [1.125, 1.625, '-0.01em', 500],
  xl: [1.25, 1.75, '-0.012em', 600],
  '2xl': [1.5, 2, '-0.016em', 600],
  '3xl': [1.875, 2.375, '-0.02em', 600],
  '4xl': [2.25, 2.75, '-0.022em', 700],
  '5xl': [3, 3.5, '-0.025em', 700],
  clock: [4, 4.5, '-0.03em', 600], // 64px: big clock / timer (tabular)
};
export const weight = { regular: 400, medium: 500, semibold: 600, bold: 700 };

// ---------------------------------------------------------------------------
// 4. Space, size, radius, elevation, motion, layers, breakpoints
// ---------------------------------------------------------------------------
export const spacingBase = '0.25rem'; // Tailwind v4: p-1 = 4px, p-4 = 16px …

export const size = {
  'touch-min': '44px', // WCAG 2.5.8 is 24px; we use Apple's 44 as the floor
  'touch-mobile': '48px', // Android/Material comfortable target
  'clock-button': '168px', // the mobile clock-in button
  'row-compact': '36px',
  'row-default': '44px',
  sidebar: '248px',
  'sidebar-collapsed': '64px',
  'content-max': '1440px',
};

export const radius = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
};

export const shadow = {
  light: {
    xs: '0 1px 2px 0 oklch(0.2 0.02 265 / 0.05)',
    sm: '0 1px 3px 0 oklch(0.2 0.02 265 / 0.08), 0 1px 2px -1px oklch(0.2 0.02 265 / 0.06)',
    md: '0 4px 8px -2px oklch(0.2 0.02 265 / 0.08), 0 2px 4px -2px oklch(0.2 0.02 265 / 0.05)',
    lg: '0 12px 24px -6px oklch(0.2 0.02 265 / 0.1), 0 4px 8px -4px oklch(0.2 0.02 265 / 0.05)',
    xl: '0 24px 48px -12px oklch(0.2 0.02 265 / 0.18)',
    'inset-highlight': 'inset 0 1px 0 0 oklch(1 0 0 / 0.6)',
  },
  // In dark mode shadows barely read; depth comes from lighter surfaces
  // plus a faint top highlight.
  dark: {
    xs: '0 1px 2px 0 oklch(0 0 0 / 0.4)',
    sm: '0 1px 3px 0 oklch(0 0 0 / 0.5), inset 0 1px 0 0 oklch(1 0 0 / 0.04)',
    md: '0 4px 12px -2px oklch(0 0 0 / 0.55), inset 0 1px 0 0 oklch(1 0 0 / 0.05)',
    lg: '0 16px 32px -8px oklch(0 0 0 / 0.6), inset 0 1px 0 0 oklch(1 0 0 / 0.06)',
    xl: '0 28px 56px -12px oklch(0 0 0 / 0.7), inset 0 1px 0 0 oklch(1 0 0 / 0.06)',
    'inset-highlight': 'inset 0 1px 0 0 oklch(1 0 0 / 0.05)',
  },
};

export const motion = {
  duration: {
    instant: '80ms',
    fast: '140ms',
    base: '200ms',
    slow: '320ms',
    slower: '480ms',
  },
  ease: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)', // most UI transitions
    decelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)', // entering elements
    accelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)', // exiting elements
    linear: 'linear', // progress, timers
  },
  // Motion (Framer Motion) / Reanimated spring presets
  spring: {
    snappy: { stiffness: 420, damping: 34, mass: 1 }, // toggles, chips, drag drop settle
    gentle: { stiffness: 260, damping: 28, mass: 1 }, // sheets, panels
    bouncy: { stiffness: 500, damping: 22, mass: 1 }, // the clock-in confirmation only
  },
};

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  dropdown: 1000,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  toast: 1500,
  tooltip: 1600,
};

export const breakpoint = {
  sm: '40rem',
  md: '48rem',
  lg: '64rem',
  xl: '80rem',
  '2xl': '96rem',
};
