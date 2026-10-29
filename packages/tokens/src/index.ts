/**
 * Design tokens — the single source of truth (UI_DESIGN_SYSTEM.md, ADR-0013).
 * `scripts/build-css.ts` turns these into src/tokens.css; tests verify contrast and freshness.
 */

export const palette = {
  neutral: {
    0: "#FFFFFF",
    25: "#F8F9FA",
    50: "#F1F3F5",
    100: "#E6E9ED",
    200: "#D3D8DE",
    300: "#B6BDC6",
    400: "#8E97A3",
    500: "#6B7480",
    600: "#535B66",
    700: "#3D444D",
    800: "#2A2F36",
    900: "#1B1F24",
    950: "#111418",
  },
  primary: { 500: "#1F4FE0", 600: "#1A43C2", 300: "#5B82FF", 50: "#EEF2FF" },
  signature: { 500: "#D4630A", 300: "#FF9A3D", 50: "#FFF4EA" },
  success: { 600: "#127540", 300: "#4CC385", 50: "#E8F6EE" },
  warning: { 600: "#8F5F0F", 300: "#E8B04B", 50: "#FBF3E3" },
  danger: { 600: "#C8312B", 300: "#F07A74", 50: "#FCECEB" },
  info: { 600: "#2563A8", 300: "#6FA6E6", 50: "#EAF2FB" },
} as const;

type Theme = Record<string, string>;
const n = palette.neutral;

/** Semantic roles. Components use only these, never raw palette values. */
export const themes: { light: Theme; dark: Theme } = {
  light: {
    "surface-base": n[25],
    "surface-raised": n[0],
    "surface-sunken": n[50],
    "surface-inverse": n[950],
    "border-subtle": n[100],
    "border-default": n[200],
    "border-strong": n[500],
    "text-primary": n[950],
    "text-secondary": n[600],
    "text-tertiary": n[500],
    "text-inverse": n[0],
    primary: palette.primary[500],
    "primary-hover": palette.primary[600],
    "primary-subtle": palette.primary[50],
    "on-primary": n[0],
    signature: palette.signature[500],
    "signature-subtle": palette.signature[50],
    success: palette.success[600],
    "success-subtle": palette.success[50],
    warning: palette.warning[600],
    "warning-subtle": palette.warning[50],
    danger: palette.danger[600],
    "danger-subtle": palette.danger[50],
    info: palette.info[600],
    "info-subtle": palette.info[50],
    focus: palette.primary[500],
    "viewer-canvas": n[950],
    "viewer-grid": n[800],
    "viewer-text": n[50],
  },
  dark: {
    "surface-base": n[950],
    "surface-raised": n[900],
    "surface-sunken": "#0C0E11",
    "surface-inverse": n[25],
    "border-subtle": n[800],
    "border-default": n[700],
    "border-strong": n[500],
    "text-primary": n[50],
    "text-secondary": n[300],
    "text-tertiary": n[400],
    "text-inverse": n[950],
    primary: palette.primary[300],
    "primary-hover": "#7C9BFF",
    "primary-subtle": "#17213F",
    "on-primary": n[950],
    signature: palette.signature[300],
    "signature-subtle": "#3A2410",
    success: palette.success[300],
    "success-subtle": "#10291C",
    warning: palette.warning[300],
    "warning-subtle": "#33270F",
    danger: palette.danger[300],
    "danger-subtle": "#3A1614",
    info: palette.info[300],
    "info-subtle": "#122235",
    focus: palette.primary[300],
    "viewer-canvas": "#0C0E11",
    "viewer-grid": n[800],
    "viewer-text": n[50],
  },
};

/** Foreground/background pairs that must meet WCAG 2.2 AA (4.5:1 text, 3:1 UI). */
export const CONTRAST_PAIRS: { fg: string; bg: string; min: number }[] = [
  { fg: "text-primary", bg: "surface-base", min: 4.5 },
  { fg: "text-primary", bg: "surface-raised", min: 4.5 },
  { fg: "text-secondary", bg: "surface-base", min: 4.5 },
  { fg: "text-secondary", bg: "surface-raised", min: 4.5 },
  { fg: "text-secondary", bg: "surface-sunken", min: 4.5 },
  { fg: "text-tertiary", bg: "surface-raised", min: 3 },
  { fg: "on-primary", bg: "primary", min: 4.5 },
  { fg: "on-primary", bg: "primary-hover", min: 4.5 },
  { fg: "primary", bg: "surface-raised", min: 4.5 },
  { fg: "primary", bg: "primary-subtle", min: 4.5 },
  { fg: "success", bg: "success-subtle", min: 4.5 },
  { fg: "warning", bg: "warning-subtle", min: 4.5 },
  { fg: "danger", bg: "danger-subtle", min: 4.5 },
  { fg: "info", bg: "info-subtle", min: 4.5 },
  { fg: "danger", bg: "surface-raised", min: 4.5 },
  { fg: "border-strong", bg: "surface-raised", min: 3 },
  { fg: "focus", bg: "surface-raised", min: 3 },
  { fg: "focus", bg: "surface-base", min: 3 },
  { fg: "signature", bg: "surface-raised", min: 3 },
  { fg: "viewer-text", bg: "viewer-canvas", min: 4.5 },
];

export const radius = { xs: "4px", s: "6px", m: "10px", l: "16px", full: "9999px" } as const;

export const elevation = {
  flat: "none",
  raised: "0 1px 2px rgb(17 20 24 / 0.06)",
  floating: "0 4px 12px rgb(17 20 24 / 0.08)",
  overlay: "0 12px 32px rgb(17 20 24 / 0.14)",
  modal: "0 24px 48px rgb(17 20 24 / 0.18)",
} as const;

/** Motion tokens (MOTION_SYSTEM.md §2). */
export const motion = {
  duration: { instant: 0, micro: 100, fast: 160, standard: 240, slow: 360, educational: 600, success: 480, critical: 200 },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    enter: "cubic-bezier(0, 0, 0, 1)",
    exit: "cubic-bezier(0.3, 0, 1, 1)",
    mechanical: "cubic-bezier(0.65, 0, 0.35, 1)",
  },
  spring: {
    snappy: { stiffness: 500, damping: 40, mass: 1 },
    gentle: { stiffness: 260, damping: 30, mass: 1 },
    success: { stiffness: 400, damping: 22, mass: 1 },
  },
  distance: { xs: 2, s: 4, m: 8, l: 16 },
} as const;

export const fontStacks = {
  sans: '"IBM Plex Sans", "IBM Plex Sans Hebrew", system-ui, -apple-system, "Segoe UI", "Noto Sans", "Noto Sans Hebrew", Arial, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

/** WCAG relative luminance contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
