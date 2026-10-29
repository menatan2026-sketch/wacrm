import { schema, eq } from "@mfg/db";
import { beforeEach, describe, expect, it } from "vitest";
import * as auth from "../../src/modules/identity/auth";
import { createHarness, type Harness } from "./harness";

let h: Harness;
beforeEach(async () => {
  h = await createHarness();
});

const codeFor = (h: Harness, email: string) =>
  h.email.sent
    .filter((m) => m.to === email)
    .at(-1)!
    .subject.match(/\d{6}/)![0];

describe("email OTP sign-in", () => {
  it("creates a customer on first sign-in, in their language", async () => {
    await auth.requestLoginCode(h.d, { email: "New@Example.com", locale: "ru", ip: "1.1.1.1" });
    const mail = h.email.sent.at(-1)!;
    expect(mail.locale).toBe("ru");
    expect(mail.subject).toContain("Ваш код");
    const r = await auth.verifyLoginCode(h.d, {
      email: "new@example.com",
      code: codeFor(h, "new@example.com"),
      surface: "customer",
      locale: "ru",
      ip: "1.1.1.1",
    });
    const actor = await auth.resolveSession(h.d, r.sessionToken, "customer");
    expect(actor!.roles.map((x) => x.role)).toEqual(["CUSTOMER"]);
    expect(actor!.locale).toBe("ru");
  });

  it("counts wrong guesses even though the attempt fails, then locks the code", async () => {
    await auth.requestLoginCode(h.d, { email: "a@example.com", locale: "en", ip: "1.1.1.1" });
    const right = codeFor(h, "a@example.com");
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      await expect(
        auth.verifyLoginCode(h.d, {
          email: "a@example.com",
          code: wrong,
          surface: "customer",
          locale: "en",
          ip: "1.1.1.1",
        }),
      ).rejects.toThrow("auth.code_invalid");
    }
    await expect(
      auth.verifyLoginCode(h.d, {
        email: "a@example.com",
        code: right,
        surface: "customer",
        locale: "en",
        ip: "1.1.1.1",
      }),
    ).rejects.toThrow("auth.too_many_attempts");
  });

  it("rejects reuse and expiry", async () => {
    await auth.requestLoginCode(h.d, { email: "b@example.com", locale: "en", ip: "1.1.1.1" });
    const code = codeFor(h, "b@example.com");
    await auth.verifyLoginCode(h.d, {
      email: "b@example.com",
      code,
      surface: "customer",
      locale: "en",
      ip: "1.1.1.1",
    });
    await expect(
      auth.verifyLoginCode(h.d, {
        email: "b@example.com",
        code,
        surface: "customer",
        locale: "en",
        ip: "1.1.1.1",
      }),
    ).rejects.toThrow("auth.code_invalid");
    await auth.requestLoginCode(h.d, { email: "b@example.com", locale: "en", ip: "1.1.1.1" });
    h.clock.advance(11 * 60 * 1000);
    await expect(
      auth.verifyLoginCode(h.d, {
        email: "b@example.com",
        code: codeFor(h, "b@example.com"),
        surface: "customer",
        locale: "en",
        ip: "1.1.1.1",
      }),
    ).rejects.toThrow("auth.code_expired");
  });

  it("keeps customers out of the admin and partner surfaces", async () => {
    await h.signIn("c@example.com");
    await auth.requestLoginCode(h.d, { email: "c@example.com", locale: "en", ip: "1.1.1.1" });
    await expect(
      auth.verifyLoginCode(h.d, {
        email: "c@example.com",
        code: codeFor(h, "c@example.com"),
        surface: "admin",
        locale: "en",
        ip: "1.1.1.1",
      }),
    ).rejects.toThrow("auth.no_access_to_surface");
  });

  it("requires MFA for staff sessions and supports enrollment", async () => {
    await auth.requestLoginCode(h.d, { email: "admin@mfg.local", locale: "en", ip: "1.1.1.1" });
    const r = await auth.verifyLoginCode(h.d, {
      email: "admin@mfg.local",
      code: codeFor(h, "admin@mfg.local"),
      surface: "admin",
      locale: "en",
      ip: "1.1.1.1",
    });
    expect(r.mfa).toBe("enroll");
    const actor = (await auth.resolveSession(h.d, r.sessionToken, "admin"))!;
    expect(actor.mfaVerified).toBe(false);
    await auth.startMfaEnrollment(h.d, actor);
    await expect(auth.verifyMfa(h.d, actor, "000000")).rejects.toThrow("auth.mfa_invalid");
    const [u] = await h.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "admin@mfg.local"));
    await auth.verifyMfa(h.d, actor, auth.currentTotp(h.d, u!.email, u!.mfaSecret!));
    expect((await auth.resolveSession(h.d, r.sessionToken, "admin"))!.mfaVerified).toBe(true);
  });

  it("revokes sessions and expires staff sessions after 8 hours", async () => {
    await auth.requestLoginCode(h.d, { email: "d@example.com", locale: "en", ip: "1.1.1.1" });
    const r = await auth.verifyLoginCode(h.d, {
      email: "d@example.com",
      code: codeFor(h, "d@example.com"),
      surface: "customer",
      locale: "en",
      ip: "1.1.1.1",
    });
    await auth.revokeSession(h.d, r.sessionToken);
    expect(await auth.resolveSession(h.d, r.sessionToken, "customer")).toBeNull();
    const staff = await h.signIn("qc@mfg.local", "admin");
    expect(staff.mfaVerified).toBe(true);
  });
});
