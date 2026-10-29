import { z } from "zod";

const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /**
     * Deployment environment. Separate from NODE_ENV because `next start` always runs with
     * NODE_ENV=production, including CI and staging. Required whenever NODE_ENV=production.
     */
    APP_ENV: z.enum(["development", "ci", "staging", "production"]).optional(),
    APP_URL: z.url().default("http://localhost:3000"),
    APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default(".local/storage"),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: bool.default(true),
    EMAIL_DRIVER: z.enum(["log", "smtp"]).default("log"),
    SMTP_URL: z.string().optional(),
    EMAIL_FROM: z.string().default("Platform <no-reply@localhost>"),
    GEOMETRY_URL: z.url().default("http://127.0.0.1:8001"),
    GEOMETRY_SHARED_SECRET: z.string().min(16),
    PAYMENT_PROVIDER: z.enum(["fake"]).default("fake"),
    PAYMENT_WEBHOOK_SECRET: z.string().min(16),
    SHIPPING_PROVIDER: z.enum(["manual", "fake"]).default("manual"),
    DEV_TOOLS_ENABLED: bool.default(false),
    UPLOAD_MAX_MODEL_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(100 * 1024 * 1024),
    UPLOAD_MAX_PHOTO_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 1024 * 1024),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.APP_ENV) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_ENV"],
        message: "required when NODE_ENV=production (ci, staging or production)",
      });
    }
    // Production must never run simulators presented as the real thing (fake PSP page, fake
    // courier tracking, log-only email) or development tools.
    if (env.APP_ENV === "production") {
      const forbidden: [keyof typeof env, boolean, string][] = [
        ["DEV_TOOLS_ENABLED", env.DEV_TOOLS_ENABLED, "must be false in production"],
        [
          "PAYMENT_PROVIDER",
          env.PAYMENT_PROVIDER === "fake",
          "the fake payment provider is not allowed in production",
        ],
        [
          "SHIPPING_PROVIDER",
          env.SHIPPING_PROVIDER === "fake",
          "the fake shipping provider is not allowed in production",
        ],
        ["EMAIL_DRIVER", env.EMAIL_DRIVER === "log", "log-only email is not allowed in production"],
      ];
      for (const [key, bad, message] of forbidden)
        if (bad) ctx.addIssue({ code: "custom", path: [key], message });
    }
    if (env.STORAGE_DRIVER === "s3") {
      for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key])
          ctx.addIssue({ code: "custom", path: [key], message: "required when STORAGE_DRIVER=s3" });
      }
    }
    if (env.EMAIL_DRIVER === "smtp" && !env.SMTP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_URL"],
        message: "required when EMAIL_DRIVER=smtp",
      });
    }
  });

export type ServerConfig = z.infer<typeof serverSchema>;

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid configuration:\n  - ${issues.join("\n  - ")}`);
    this.name = "ConfigError";
  }
}

export function parseServerConfig(source: Record<string, string | undefined>): ServerConfig {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  return Object.freeze(result.data);
}

let cached: ServerConfig | undefined;

/** Server configuration, validated once per process. Never import this from client code. */
export function serverConfig(): ServerConfig {
  cached ??= parseServerConfig(process.env);
  return cached;
}

/** Test hook: reset the cached config after mutating process.env. */
export function resetServerConfigForTests(): void {
  cached = undefined;
}
