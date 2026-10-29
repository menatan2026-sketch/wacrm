import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, createPool, schema, eq, sql, type Db, type Surface } from "@mfg/db";
import { FakeGeometryClient } from "../../src/adapters/geometry";
import { InternalInvoiceProvider } from "../../src/adapters/invoices-internal";
import { FakePaymentProvider } from "../../src/adapters/payments-fake";
import { FakeShippingProvider } from "../../src/adapters/shipping";
import { LocalStorage } from "../../src/adapters/storage-local";
import type { Deps } from "../../src/deps";
import { drainOutbox } from "../../src/events";
import * as auth from "../../src/modules/identity/auth";
import { MemoryEmailSender } from "../../src/modules/notifications/email";
import * as files from "../../src/modules/files/service";
import { invalidateFlagCache } from "../../src/platform/flags";
import { MemoryRateLimiter } from "../../src/platform/rate-limit";
import type { Actor, Clock, Ctx, UserActor } from "../../src/shared/context";
import { seedDevelopment, seedReference } from "../../src/seed";
import { TEST_DATABASE_URL } from "./global-setup";

export class TestClock implements Clock {
  constructor(public current = new Date("2026-11-01T08:00:00Z")) {}
  now() {
    return new Date(this.current);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export interface Harness {
  d: Deps;
  db: Db;
  clock: TestClock;
  email: MemoryEmailSender;
  geometry: FakeGeometryClient;
  payments: FakePaymentProvider;
  storage: LocalStorage;
  ctx(actor: Actor): Ctx;
  signIn(
    email: string,
    surface?: Surface,
    opts?: { inviteToken?: string; anonKey?: string },
  ): Promise<UserActor>;
  uploadModel(actor: Actor, name?: string, bytes?: Buffer): Promise<string>;
  uploadPhoto(actor: Actor, kind?: "photo" | "qc_photo"): Promise<string>;
  drain(): Promise<number>;
  close(): Promise<void>;
}

let pool: ReturnType<typeof createPool> | undefined;

export async function createHarness(): Promise<Harness> {
  pool ??= createPool(TEST_DATABASE_URL, 5);
  const db = createDb(pool);
  const tables = Object.values(schema)
    .filter(
      (t): t is typeof schema.users =>
        typeof t === "object" && t !== null && Symbol.for("drizzle:Name") in t,
    )
    .map((t) => `"${(t as unknown as Record<symbol, string>)[Symbol.for("drizzle:Name")]}"`);
  // TRUNCATE bypasses row triggers, so insert-only tables can be reset between tests.
  await db.execute(sql.raw(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`));
  invalidateFlagCache();
  await seedReference(db);
  await seedDevelopment(db);

  const clock = new TestClock();
  const email = new MemoryEmailSender();
  const geometry = new FakeGeometryClient();
  const secret = "test-secret-".padEnd(40, "x");
  const payments = new FakePaymentProvider("http://test.local", "webhook-secret-1234");
  const storage = new LocalStorage(
    mkdtempSync(path.join(tmpdir(), "mfg-storage-")),
    "http://test.local",
    secret,
  );
  const d: Deps = {
    db,
    secret,
    appUrl: "http://test.local",
    email,
    storage,
    geometry,
    payments,
    shipping: new FakeShippingProvider(),
    invoices: new InternalInvoiceProvider(),
    rateLimiter: new MemoryRateLimiter(),
    clock,
    limits: { maxModelBytes: 100 * 1024 * 1024, maxPhotoBytes: 15 * 1024 * 1024 },
  };
  const ctx = (actor: Actor): Ctx => ({ db, actor, clock, requestId: "test" });

  async function signIn(
    address: string,
    surface: Surface = "customer",
    opts: { inviteToken?: string } = {},
  ): Promise<UserActor> {
    await auth.requestLoginCode(d, { email: address, locale: "en", ip: "127.0.0.1" });
    const code = email.sent
      .filter((m) => m.to === address.toLowerCase())
      .at(-1)!
      .subject.match(/\d{6}/)![0];
    const result = await auth.verifyLoginCode(d, {
      email: address,
      code,
      surface,
      locale: "en",
      ip: "127.0.0.1",
      inviteToken: opts.inviteToken,
    });
    let actor = await auth.resolveSession(d, result.sessionToken, surface);
    if (surface === "admin") {
      if (result.mfa === "enroll") await auth.startMfaEnrollment(d, actor!);
      const [u] = await db.select().from(schema.users).where(eq(schema.users.id, result.userId));
      await auth.verifyMfa(d, actor!, auth.currentTotp(d, u!.email, u!.mfaSecret!));
      actor = await auth.resolveSession(d, result.sessionToken, surface);
    }
    return actor!;
  }

  async function putThroughSession(
    actor: Actor,
    name: string,
    bytes: Buffer,
    kind: "model" | "photo" | "qc_photo",
  ) {
    const session = await files.createUploadSession(d, ctx(actor), {
      fileName: name,
      size: bytes.length,
      kind,
    });
    const token = new URL(session.upload.url).searchParams.get("token")!;
    const claim = storage.verifyUpload(token)!;
    await storage.put(claim.k, bytes);
    await files.completeUpload(d, ctx(actor), session.fileId);
    return session.fileId;
  }

  return {
    d,
    db,
    clock,
    email,
    geometry,
    payments,
    storage,
    ctx,
    signIn,
    uploadModel: (
      actor,
      name = "bracket.stl",
      bytes = Buffer.from("solid fake\nendsolid fake\n"),
    ) => putThroughSession(actor, name, bytes, "model"),
    uploadPhoto: (actor, kind = "photo") =>
      putThroughSession(
        actor,
        `photo-${Math.random().toString(36).slice(2)}.jpg`,
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
        kind,
      ),
    drain: () => drainOutbox(d),
    async close() {},
  };
}
