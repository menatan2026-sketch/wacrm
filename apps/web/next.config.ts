import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// One .env at the repository root serves the web app and the worker.
const rootEnv = path.resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** Static security headers. The nonce-based CSP is set per request in src/proxy.ts. */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera is allowed for same-origin photo capture in Flow B and supplier QC evidence.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
];

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@mfg/core", "@mfg/db", "@mfg/config", "@mfg/i18n", "@mfg/logging", "@mfg/tokens", "@mfg/ui", "@mfg/motion"],
  serverExternalPackages: ["pg", "pino", "ioredis", "bullmq", "@aws-sdk/client-s3", "nodemailer"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(config);
