import path from "node:path";
import type { NextConfig } from "next";

// This app lives inside the wacrm repository; pin the workspace root so
// Next doesn't pick up the CRM's lockfile and PostCSS/Tailwind config.
const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root },
  outputFileTracingRoot: root,
  async headers() {
    return [
      {
        // 3D assets are content-addressed by filename: bump the file name
        // (e.g. studio-car.v2.glb) when replacing a model.
        source: "/(models|draco)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
