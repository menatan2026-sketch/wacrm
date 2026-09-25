import { describe, expect, it } from "vitest";
import { normalisePhone, validateLead } from "./index";

describe("leads", () => {
  it("normalises Israeli local numbers to E.164", () => {
    expect(normalisePhone("050-123-4567")).toBe("+972501234567");
    expect(normalisePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalisePhone("12")).toBeNull();
  });

  it("rejects leads without consent or contact details", () => {
    const r = validateLead({ source: "sourcing-request", name: "D", phone: "", consent: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(["name", "phone", "consent"]));
  });

  it("accepts a complete lead", () => {
    const r = validateLead({ source: "vehicle-request", name: "Dana", phone: "0521234567", consent: true, vehicleSlug: "x" });
    expect(r.ok).toBe(true);
  });
});
