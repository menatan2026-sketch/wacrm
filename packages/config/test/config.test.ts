import { describe, expect, it } from "vitest";
import { ConfigError, parseServerConfig } from "../src/index";

const base = {
  APP_SECRET: "x".repeat(32),
  DATABASE_URL: "postgres://localhost/db",
  GEOMETRY_SHARED_SECRET: "g".repeat(16),
  PAYMENT_WEBHOOK_SECRET: "p".repeat(16),
};

describe("parseServerConfig", () => {
  it("applies defaults", () => {
    const cfg = parseServerConfig(base);
    expect(cfg.STORAGE_DRIVER).toBe("local");
    expect(cfg.DEV_TOOLS_ENABLED).toBe(false);
  });

  it("reports every invalid variable", () => {
    expect(() => parseServerConfig({ APP_SECRET: "short" })).toThrowError(ConfigError);
    try {
      parseServerConfig({ APP_SECRET: "short" });
    } catch (e) {
      const issues = (e as ConfigError).issues.join(" ");
      expect(issues).toContain("APP_SECRET");
      expect(issues).toContain("DATABASE_URL");
    }
  });

  it("refuses dev tools in production", () => {
    expect(() => parseServerConfig({ ...base, NODE_ENV: "production", DEV_TOOLS_ENABLED: "true" })).toThrow(
      /DEV_TOOLS_ENABLED/,
    );
  });

  it("requires S3 credentials for the s3 driver", () => {
    expect(() => parseServerConfig({ ...base, STORAGE_DRIVER: "s3" })).toThrow(/S3_BUCKET/);
  });
});
