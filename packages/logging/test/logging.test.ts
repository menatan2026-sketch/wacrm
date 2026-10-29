import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, currentLogContext, hashPii, withLogContext } from "../src/index";

describe("log context", () => {
  it("propagates across async boundaries and nests", async () => {
    await withLogContext({ request_id: "r1" }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      await withLogContext({ order_id: "o1" }, async () => {
        expect(currentLogContext()).toEqual({ request_id: "r1", order_id: "o1" });
      });
      expect(currentLogContext()).toEqual({ request_id: "r1" });
    });
  });

  it("hashes PII stably and case-insensitively", () => {
    expect(hashPii("A@B.com ")).toBe(hashPii("a@b.com"));
    expect(hashPii("a@b.com")).not.toContain("@");
  });

  it("redacts sensitive keys and attaches the context", () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(c, _e, cb) {
        lines.push(String(c));
        cb();
      },
    });
    const log = createLogger({ name: "t", destination: sink });
    withLogContext({ request_id: "req-9" }, () => {
      log.info({ email: "a@b.com", otp: { code: "123456" } }, "hi");
    });
    expect(lines[0]).not.toContain("a@b.com");
    expect(lines[0]).not.toContain("123456");
    expect(JSON.parse(lines[0]!).request_id).toBe("req-9");
  });
});
