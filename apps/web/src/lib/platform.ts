import "server-only";
import { serverConfig } from "@mfg/config";
import { createPlatform, type Platform } from "@mfg/core";

const globalForPlatform = globalThis as unknown as { __mfgPlatform?: Platform };

/** One platform (DB pool, Redis, adapters) per server process, reused across hot reloads. */
export function platform(): Platform {
  globalForPlatform.__mfgPlatform ??= createPlatform(serverConfig(), {
    rootDir: process.env.MFG_ROOT,
  });
  return globalForPlatform.__mfgPlatform;
}

export const deps = () => platform().deps;
