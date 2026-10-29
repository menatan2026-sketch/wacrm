import { createRequire } from "node:module";
import { URL } from "node:url";
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// eslint-config-next is installed with the web app (monorepo: Next.js isn't at the root).
const webRequire = createRequire(new URL("./apps/web/package.json", import.meta.url));
const nextVitals = webRequire("eslint-config-next/core-web-vitals");

const REACT_FILES = [
  "apps/web/**/*.{ts,tsx}",
  "packages/ui/**/*.{ts,tsx}",
  "packages/motion/**/*.{ts,tsx}",
];
const UI_FILES = [
  "apps/web/src/**/*.tsx",
  "packages/ui/src/**/*.tsx",
  "packages/motion/src/**/*.tsx",
];

/**
 * Physical direction utilities break RTL; use logical ones (ms-/me-/ps-/pe-/start-/end-/text-start).
 * (rounded-s/m/l are radius sizes in our token scale, not sides, so they are not matched.)
 */
/** Physical direction utilities break RTL; use logical ones (ms-/me-/ps-/pe-/start-/end-/text-start). */
const PHYSICAL_CLASS = String.raw`(^|\s|:)(-?m[lr]-|-?p[lr]-|left-|right-|text-(left|right)\b|border-[lr]-|float-(left|right)|scroll-[mp][lr]-)`;

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/dist/**",
    "**/coverage/**",
    "**/next-env.d.ts",
    ".local/**",
    "services/**",
    "docs/**",
    "tests/e2e/test-results/**",
    "tests/e2e/playwright-report/**",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  ...nextVitals.map((c) => ({ ...c, files: REACT_FILES })),
  {
    files: REACT_FILES,
    settings: { next: { rootDir: "apps/web/" }, react: { version: "19" } },
  },
  {
    // LOCALIZATION_GLOSSARY §1: no user-visible literals in UI code, and logical CSS only.
    files: UI_FILES,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: String.raw`JSXText[value=/[A-Za-z֐-׿Ѐ-ӿ]{2,}/]`,
          message: "User-visible text must come from the message catalogs (packages/i18n).",
        },
        {
          selector: `JSXAttribute[name.name=/^(aria-label|title|placeholder|alt)$/] > Literal[value=/[A-Za-z\\u0590-\\u05FF\\u0400-\\u04FF]{2,}/]`,
          message: "Accessible names and placeholders must come from the message catalogs.",
        },
        {
          selector: `Literal[value=/${PHYSICAL_CLASS}/]`,
          message:
            "Use logical direction utilities (ms-/me-/ps-/pe-/start-/end-/text-start) so RTL works.",
        },
        {
          selector: `TemplateElement[value.raw=/${PHYSICAL_CLASS}/]`,
          message:
            "Use logical direction utilities (ms-/me-/ps-/pe-/start-/end-/text-start) so RTL works.",
        },
      ],
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        module: "writable",
        require: "readonly",
        process: "readonly",
        __dirname: "readonly",
        console: "readonly",
      },
    },
  },
  {
    files: ["**/*.cjs", "**/scripts/**", "apps/worker/**", "packages/*/scripts/**", "tests/**"],
    rules: { "no-console": "off", "@typescript-eslint/no-require-imports": "off" },
  },
]);
