import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The WebGL layer mutates Three.js objects (materials, uniforms,
    // geometries) inside the render loop by design — that's how R3F
    // avoids re-rendering React 60 times a second.
    files: ["src/components/three/**"],
    rules: { "react-hooks/immutability": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/draco/**"]),
]);
