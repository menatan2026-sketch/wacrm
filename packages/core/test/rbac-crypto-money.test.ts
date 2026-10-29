import { ROLES } from "@mfg/db";
import { describe, expect, it } from "vitest";
import { can, PERMISSIONS, ROLE_PERMISSIONS } from "../src/modules/identity/rbac";
import type { Actor, RoleGrant } from "../src/shared/context";
import { hmac, randomDigits, seal, signPayload, unseal, verifyPayload } from "../src/shared/crypto";
import { applyBps, roundToStep, taxFromGross } from "../src/shared/money";

const user = (roles: RoleGrant[]): Actor => ({ kind: "user", userId: "u", email: "e", locale: "he", roles, sessionId: "s", surface: "admin", mfaVerified: true });

describe("RBAC permission matrix", () => {
  it("grants exactly the declared permissions for platform-scoped roles", () => {
    for (const role of ROLES) {
      if (role === "SUPPLIER_OPERATOR" || role === "SUPPLIER_MANAGER") continue;
      const actor = user([{ role, scopeType: "platform", scopeId: null }]);
      for (const p of PERMISSIONS) expect(can(actor, p), `${role} ${p}`).toBe(ROLE_PERMISSIONS[role].includes(p));
    }
  });

  it("limits supplier roles to their own supplier", () => {
    const actor = user([{ role: "SUPPLIER_MANAGER", scopeType: "supplier", scopeId: "s1" }]);
    expect(can(actor, "job.respond", { supplierId: "s1" })).toBe(true);
    expect(can(actor, "job.respond", { supplierId: "s2" })).toBe(false);
    expect(can(actor, "job.respond")).toBe(false);
    expect(can(actor, "order.read.any")).toBe(false);
  });

  it("denies guests everything and allows the system", () => {
    expect(can({ kind: "guest", anonKey: null }, "order.read.own")).toBe(false);
    expect(can({ kind: "system", name: "t" }, "refund.approve")).toBe(true);
  });

  it("keeps refund approval and pricing activation with finance", () => {
    const admin = user([{ role: "ADMIN", scopeType: "platform", scopeId: null }]);
    expect(can(admin, "refund.approve")).toBe(false);
    expect(can(admin, "pricing.rules.activate")).toBe(false);
  });
});

describe("crypto helpers", () => {
  it("seals and unseals, and detects tampering", () => {
    const s = seal("k".repeat(32), "p", "secret");
    expect(unseal("k".repeat(32), "p", s)).toBe("secret");
    expect(() => unseal("k".repeat(32), "other", s)).toThrow();
  });
  it("signs payloads and rejects forged ones", () => {
    const t = signPayload("x".repeat(32), { a: 1 });
    expect(verifyPayload("x".repeat(32), t)).toEqual({ a: 1 });
    expect(verifyPayload("y".repeat(32), t)).toBeNull();
    expect(verifyPayload("x".repeat(32), t.replace(/^./, "Z"))).toBeNull();
  });
  it("generates digits and stable HMACs", () => {
    expect(randomDigits(6)).toMatch(/^\d{6}$/);
    expect(hmac("a", "b")).toBe(hmac("a", "b"));
  });
});

describe("money", () => {
  it("rounds half away from zero to a step", () => {
    expect(roundToStep(149, 100)).toBe(100);
    expect(roundToStep(150, 100)).toBe(200);
    expect(roundToStep(-150, 100)).toBe(-200);
  });
  it("applies basis points and extracts VAT from gross", () => {
    expect(applyBps(10000, 1800)).toBe(1800);
    expect(taxFromGross(11800, 1800)).toBe(1800);
  });
});
