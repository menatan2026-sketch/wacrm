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

  it("refuses dev tools and simulators in production", () => {
    const prod = {
      ...base,
      NODE_ENV: "production",
      APP_ENV: "production",
      EMAIL_DRIVER: "smtp",
      SMTP_URL: "smtp://x",
      SHIPPING_PROVIDER: "manual",
    };
    expect(() => parseServerConfig({ ...prod, DEV_TOOLS_ENABLED: "true" })).toThrow(
      /DEV_TOOLS_ENABLED/,
    );
    // The only payment adapter today is the fake one, so production cannot start until a real PSP exists.
    expect(() => parseServerConfig(prod)).toThrow(/PAYMENT_PROVIDER/);
    expect(() => parseServerConfig({ ...prod, SHIPPING_PROVIDER: "fake" })).toThrow(
      /SHIPPING_PROVIDER/,
    );
    expect(() => parseServerConfig({ ...prod, EMAIL_DRIVER: "log" })).toThrow(/EMAIL_DRIVER/);
  });

  it("requires APP_ENV under NODE_ENV=production, and allows simulators in CI", () => {
    expect(() => parseServerConfig({ ...base, NODE_ENV: "production" })).toThrow(/APP_ENV/);
    const ci = parseServerConfig({
      ...base,
      NODE_ENV: "production",
      APP_ENV: "ci",
      DEV_TOOLS_ENABLED: "true",
    });
    expect(ci.DEV_TOOLS_ENABLED).toBe(true);
  });

  it("requires S3 credentials for the s3 driver", () => {
    expect(() => parseServerConfig({ ...base, STORAGE_DRIVER: "s3" })).toThrow(/S3_BUCKET/);
  });
});
