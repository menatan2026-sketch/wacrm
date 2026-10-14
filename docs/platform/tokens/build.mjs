#!/usr/bin/env node
// Builds design tokens and enforces WCAG contrast.
//   node docs/platform/tokens/build.mjs
// Outputs (next to this file): tokens.css, tokens.json, tokens.native.json,
// contrast-report.md. Exits 1 if any contrast contract fails.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from './tokens.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// Writes a generated file next to this script; exits with a clear message
// (instead of a bare stack trace) if the file can't be written.
function writeOutput(name, contents) {
  try {
    writeFileSync(join(here, name), contents);
  } catch (err) {
    console.error(`tokens: failed to write ${name}: ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- color math
function oklchToLinear([L, C, h]) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const EPS = 1e-4;
const inGamut = (lch) =>
  oklchToLinear(lch).every((v) => v >= -EPS && v <= 1 + EPS);
function clampChroma([L, C, h]) {
  if (inGamut([L, C, h])) return [L, C, h];
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut([L, mid, h])) lo = mid;
    else hi = mid;
  }
  return [L, lo, h];
}
const gamma = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
function toHex(lch) {
  return (
    '#' +
    oklchToLinear(lch)
      .map((v) =>
        Math.round(clamp01(gamma(clamp01(v))) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}
function luminance(lch) {
  const [r, g, b] = oklchToLinear(lch).map(clamp01);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const fmt = ([L, C, h]) =>
  `oklch(${+L.toFixed(3)} ${+C.toFixed(3)} ${C < 0.0005 ? 0 : h})`;

// ---------------------------------------------------------------- primitives
const palette = { white: { '': [1, 0, 0] } };
palette.neutral = Object.fromEntries(
  Object.entries(T.neutral.scale).map(([k, [L, C]]) => [k, [L, C, T.neutral.h]])
);
for (const [name, { h, c }] of Object.entries(T.hues)) {
  palette[name] = Object.fromEntries(
    T.steps.map((s) => [
      s,
      clampChroma([T.stepLightness[s], c * T.stepChroma[s], h]),
    ])
  );
}

function resolve(ref) {
  if (ref === 'white') return palette.white[''];
  const m = /^([a-z]+)\.(\d+)$/.exec(ref);
  if (!m) return null; // literal CSS (e.g. overlay with alpha)
  const v = palette[m[1]]?.[m[2]];
  if (!v) throw new Error(`Unknown color reference: ${ref}`);
  return v;
}
const css = (ref) => {
  const v = resolve(ref);
  return v ? fmt(v) : ref;
};
const hex = (ref) => {
  const v = resolve(ref);
  return v ? toHex(v) : ref;
};

// ---------------------------------------------------------------- semantic sets
// Flatten everything into { light: {name: ref}, dark: {name: ref} }.
const themes = { light: { ...T.semantic.light }, dark: { ...T.semantic.dark } };
for (const [name, s] of Object.entries(T.semantic.status)) {
  for (const mode of ['light', 'dark']) {
    for (const [k, ref] of Object.entries(s[mode]))
      themes[mode][`${name}-${k}`] = ref;
  }
}
const softSet = (hue, mode) =>
  hue === 'neutral'
    ? mode === 'light'
      ? { dot: 'neutral.500', soft: 'neutral.100', 'on-soft': 'neutral.700' }
      : { dot: 'neutral.500', soft: 'neutral.850', 'on-soft': 'neutral.300' }
    : mode === 'light'
      ? { dot: `${hue}.600`, soft: `${hue}.50`, 'on-soft': `${hue}.800` }
      : { dot: `${hue}.400`, soft: `${hue}.950`, 'on-soft': `${hue}.200` };
for (const group of ['attendance', 'activity']) {
  for (const [state, hue] of Object.entries(T.semantic[group])) {
    for (const mode of ['light', 'dark']) {
      for (const [k, ref] of Object.entries(softSet(hue, mode))) {
        themes[mode][`${group}-${state}-${k}`] = ref;
      }
    }
  }
}
T.semantic.shift.forEach((hue, i) => {
  const n = i + 1;
  Object.assign(themes.light, {
    [`shift-${n}-bg`]: `${hue}.100`,
    [`shift-${n}-border`]: `${hue}.300`,
    [`shift-${n}-fg`]: `${hue}.800`,
    [`shift-${n}-accent`]: `${hue}.600`,
  });
  Object.assign(themes.dark, {
    [`shift-${n}-bg`]: `${hue}.900`,
    [`shift-${n}-border`]: `${hue}.700`,
    [`shift-${n}-fg`]: `${hue}.100`,
    [`shift-${n}-accent`]: `${hue}.400`,
  });
});
T.semantic.chart.forEach((hue, i) => {
  themes.light[`chart-${i + 1}`] = `${hue}.600`;
  themes.dark[`chart-${i + 1}`] = `${hue}.400`;
});

// ---------------------------------------------------------------- contrast checks
const pairs = [...T.contrastPairs];
for (const name of Object.keys(T.semantic.status)) {
  pairs.push(
    [`${name}-on-solid`, `${name}-solid`, 4.5],
    [`${name}-on-soft`, `${name}-soft`, 4.5],
    [`${name}-fg`, 'surface', 4.5]
  );
  // A solid fill with white text must also stand off the surface. Amber
  // (warning) fills carry dark text and a border instead, so they are exempt.
  if (T.semantic.status[name].light['on-solid'] === 'white') {
    pairs.push([`${name}-solid`, 'surface', 3]);
  }
}
for (const group of ['attendance', 'activity']) {
  for (const state of Object.keys(T.semantic[group])) {
    pairs.push(
      [`${group}-${state}-on-soft`, `${group}-${state}-soft`, 4.5],
      [`${group}-${state}-dot`, 'surface', 3]
    );
  }
}
T.semantic.shift.forEach((_, i) =>
  pairs.push([`shift-${i + 1}-fg`, `shift-${i + 1}-bg`, 4.5])
);
T.semantic.chart.forEach((_, i) =>
  pairs.push([`chart-${i + 1}`, 'surface', 3])
);

const results = [];
for (const mode of ['light', 'dark']) {
  for (const [fg, bg, min] of pairs) {
    const a = resolve(themes[mode][fg]);
    const b = resolve(themes[mode][bg]);
    if (!a || !b)
      throw new Error(`Cannot check ${mode} ${fg}/${bg}: not a solid color`);
    const ratio = contrast(a, b);
    results.push({ mode, fg, bg, min, ratio, ok: ratio >= min });
  }
}
const failures = results.filter((r) => !r.ok);

// ---------------------------------------------------------------- tokens.css
const lines = [];
const out = (s = '') => lines.push(s);
out('/* GENERATED by build.mjs from tokens.mjs. Do not edit by hand. */');
out('/* Tailwind v4: @import "tailwindcss"; @import "./tokens.css"; */');
out(
  '@custom-variant dark (&:where(.dark, .dark *, [data-theme="dark"], [data-theme="dark"] *));'
);
out();
out('@theme {');
out('  --color-*: initial; /* only our palette, no Tailwind defaults */');
out(`  --color-white: ${css('white')};`);
for (const [name, scale] of Object.entries(palette)) {
  if (name === 'white') continue;
  for (const [step, v] of Object.entries(scale))
    out(`  --color-${name}-${step}: ${fmt(v)};`);
}
out();
out(`  --font-sans: ${T.font.sans};`);
out(`  --font-mono: ${T.font.mono};`);
out(`  --font-sans--font-feature-settings: "cv11" 1;`);
for (const [k, v] of Object.entries(T.weight))
  out(`  --font-weight-${k}: ${v};`);
for (const [k, [fs, lh, , w]] of Object.entries(T.type)) {
  out(`  --text-${k}: ${fs}rem;`);
  out(`  --text-${k}--line-height: ${lh}rem;`);
  out(`  --text-${k}--letter-spacing: var(--tracking-${k});`);
  out(`  --text-${k}--font-weight: ${w};`);
}
out();
out(`  --spacing: ${T.spacingBase};`);
for (const [k, v] of Object.entries(T.radius)) out(`  --radius-${k}: ${v};`);
for (const [k, v] of Object.entries(T.motion.ease)) out(`  --ease-${k}: ${v};`);
for (const [k, v] of Object.entries(T.breakpoint))
  out(`  --breakpoint-${k}: ${v};`);
out('}');
out();
out(
  '/* Semantic tokens → utilities (bg-surface, text-foreground-muted, border-border-input, shadow-md …) */'
);
out('@theme inline {');
for (const name of Object.keys(themes.light))
  out(`  --color-${name}: var(--${name});`);
for (const k of Object.keys(T.shadow.light))
  out(`  --shadow-${k}: var(--elevation-${k});`);
out('}');
out();
const emitTheme = (mode) => {
  for (const [name, ref] of Object.entries(themes[mode]))
    out(`  --${name}: ${css(ref)};`);
  for (const [k, v] of Object.entries(T.shadow[mode]))
    out(`  --elevation-${k}: ${v};`);
};
out(':root {');
out('  color-scheme: light;');
emitTheme('light');
for (const [k, [, , ls]] of Object.entries(T.type))
  out(`  --tracking-${k}: ${ls};`);
for (const [k, v] of Object.entries(T.motion.duration))
  out(`  --duration-${k}: ${v};`);
for (const [k, v] of Object.entries(T.size)) out(`  --size-${k}: ${v};`);
for (const [k, v] of Object.entries(T.zIndex)) out(`  --z-${k}: ${v};`);
out('}');
out();
out(':root.dark, [data-theme="dark"] {');
out('  color-scheme: dark;');
emitTheme('dark');
out('}');
out();
out(
  '/* Hebrew is never letter-spaced: negative tracking breaks its letterforms. */'
);
out(':root:lang(he) {');
for (const k of Object.keys(T.type)) out(`  --tracking-${k}: 0;`);
out('}');
out();
out('@media (prefers-reduced-motion: reduce) {');
out('  :root {');
for (const k of Object.keys(T.motion.duration))
  out(`    --duration-${k}: 0ms;`);
out('  }');
out('}');
writeOutput('tokens.css', lines.join('\n') + '\n');

// ---------------------------------------------------------------- tokens.json (DTCG)
const dtcg = { color: {}, theme: { light: {}, dark: {} } };
for (const [name, scale] of Object.entries(palette)) {
  if (name === 'white') {
    dtcg.color.white = { $type: 'color', $value: fmt(scale['']) };
    continue;
  }
  dtcg.color[name] = Object.fromEntries(
    Object.entries(scale).map(([s, v]) => [
      s,
      { $type: 'color', $value: fmt(v) },
    ])
  );
}
const dtcgRef = (ref) => (resolve(ref) ? `{color.${ref}}` : ref);
for (const mode of ['light', 'dark']) {
  for (const [name, ref] of Object.entries(themes[mode])) {
    dtcg.theme[mode][name] = { $type: 'color', $value: dtcgRef(ref) };
  }
  for (const [k, v] of Object.entries(T.shadow[mode])) {
    dtcg.theme[mode][`elevation-${k}`] = { $type: 'shadow', $value: v };
  }
}
dtcg.font = {
  sans: { $type: 'fontFamily', $value: T.font.sans },
  mono: { $type: 'fontFamily', $value: T.font.mono },
};
dtcg.type = Object.fromEntries(
  Object.entries(T.type).map(([k, [fs, lh, ls, w]]) => [
    k,
    {
      $type: 'typography',
      $value: {
        fontSize: `${fs}rem`,
        lineHeight: `${lh}rem`,
        letterSpacing: ls,
        fontWeight: w,
      },
    },
  ])
);
dtcg.radius = Object.fromEntries(
  Object.entries(T.radius).map(([k, v]) => [
    k,
    { $type: 'dimension', $value: v },
  ])
);
dtcg.size = Object.fromEntries(
  Object.entries(T.size).map(([k, v]) => [k, { $type: 'dimension', $value: v }])
);
dtcg.duration = Object.fromEntries(
  Object.entries(T.motion.duration).map(([k, v]) => [
    k,
    { $type: 'duration', $value: v },
  ])
);
dtcg.easing = Object.fromEntries(
  Object.entries(T.motion.ease).map(([k, v]) => [
    k,
    { $type: 'cubicBezier', $value: v },
  ])
);
dtcg.spring = T.motion.spring;
dtcg.zIndex = T.zIndex;
dtcg.breakpoint = T.breakpoint;
dtcg.spacing = { base: { $type: 'dimension', $value: T.spacingBase } };
writeOutput('tokens.json', JSON.stringify(dtcg, null, 2) + '\n');

// ---------------------------------------------------------------- tokens.native.json
// React Native can't parse oklch(), so mobile and desktop-native get hex.
const native = {
  light: Object.fromEntries(
    Object.entries(themes.light).map(([k, r]) => [k, hex(r)])
  ),
  dark: Object.fromEntries(
    Object.entries(themes.dark).map(([k, r]) => [k, hex(r)])
  ),
  palette: Object.fromEntries(
    Object.entries(palette).map(([n, s]) => [
      n,
      Object.fromEntries(Object.entries(s).map(([k, v]) => [k, toHex(v)])),
    ])
  ),
  spacing: 4,
  radius: Object.fromEntries(
    Object.entries(T.radius).map(([k, v]) => [k, parseInt(v, 10)])
  ),
  type: Object.fromEntries(
    Object.entries(T.type).map(([k, [fs, lh, ls, w]]) => [
      k,
      {
        fontSize: fs * 16,
        lineHeight: lh * 16,
        letterSpacingEm: parseFloat(ls),
        fontWeight: String(w),
      },
    ])
  ),
  duration: Object.fromEntries(
    Object.entries(T.motion.duration).map(([k, v]) => [k, parseInt(v, 10)])
  ),
  spring: T.motion.spring,
  touch: { min: 44, mobile: 48, clockButton: 168 },
};
writeOutput('tokens.native.json', JSON.stringify(native, null, 2) + '\n');

// ---------------------------------------------------------------- report
const rep = [
  '# Contrast report (generated)',
  '',
  `${results.length} checks · ${results.length - failures.length} pass · ${failures.length} fail`,
  '',
  '| Theme | Foreground | Background | Min | Ratio | |',
  '|---|---|---|---|---|---|',
  ...results.map(
    (r) =>
      `| ${r.mode} | \`${r.fg}\` | \`${r.bg}\` | ${r.min} | ${r.ratio.toFixed(2)} | ${r.ok ? '✅' : '❌'} |`
  ),
];
writeOutput('contrast-report.md', rep.join('\n') + '\n');

console.log(
  `tokens: ${Object.keys(themes.light).length} semantic tokens per theme`
);
console.log(
  `contrast: ${results.length - failures.length}/${results.length} pass`
);
for (const f of failures) {
  console.log(
    `  FAIL ${f.mode.padEnd(5)} ${f.fg} on ${f.bg}: ${f.ratio.toFixed(2)} < ${f.min}`
  );
}
process.exit(failures.length ? 1 : 0);
