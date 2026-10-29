import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { Redis } from "ioredis";
import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://mfg@127.0.0.1:5432/mfg",
  max: 2,
});

export async function one<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T> {
  const r = await pool.query(text, values);
  return r.rows[0] as T;
}

export const localeOf = (info: TestInfo) =>
  (info.project.metadata as { locale: "he" | "en" | "ru" }).locale;

/** Latest sign-in code from the dev mailbox (LogEmailSender stores every message in email_messages). */
export async function latestCode(email: string, since: Date): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const row = await one<{ subject: string } | undefined>(
      "SELECT subject FROM email_messages WHERE to_address = $1 AND created_at >= $2 ORDER BY created_at DESC LIMIT 1",
      [email, since],
    );
    const m = row?.subject.match(/\d{6}/);
    if (m) return m[0];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no sign-in code for ${email}`);
}

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

/**
 * Production login limits (5 codes per email, 20 per IP per 15 min) are lower than one matrix run
 * needs from 127.0.0.1. Instead of weakening them, clear the counters on the local dev Redis.
 */
async function resetLoginLimits() {
  if (!/\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(REDIS_URL))
    throw new Error("refusing to reset rate limits on a non-local Redis");
  const redis = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  await redis.connect();
  for (const pattern of ["rl:login-*", "rl:mfa:*"]) {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  }
  await redis.quit();
}

export async function signIn(page: Page, path: string, email: string) {
  await resetLoginLimits();
  await page.goto(path);
  const since = new Date(Date.now() - 1000);
  await page.locator("input[name=email]").fill(email);
  await page.locator("main form button[type=submit]").click();
  await page.locator("input[name=code]").fill(await latestCode(email, since));
  await page.locator("main form button[type=submit]").click();
  await page.waitForURL((u) => !u.pathname.endsWith("/sign-in"));
}

function base32(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "")) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — what an authenticator app would show. */
export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", base32(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Complete staff MFA: enroll (remembering the key for later runs) or verify. */
export async function passMfa(page: Page, email: string, locale: string) {
  await page.waitForURL(/\/ops\/mfa/);
  const store = `.e2e-state/mfa-${email}`;
  const key = page.getByTestId("mfa-secret");
  let secret: string;
  if (await key.isVisible()) {
    secret = (await key.textContent())!.replace(/\s/g, "");
    mkdirSync(".e2e-state", { recursive: true });
    writeFileSync(store, secret);
  } else {
    if (!existsSync(store))
      throw new Error(
        `${email} has MFA from outside this run; global-setup resets only the accounts it lists`,
      );
    secret = readFileSync(store, "utf8");
  }
  await page.locator("input[autocomplete=one-time-code]").fill(totp(secret));
  await page.locator("main form button[type=submit]").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/ops$`));
}

/** A 60 × 40 × 25 mm closed box as binary STL (12 triangles). */
export function boxStl(x = 60, y = 40, z = 25): Buffer {
  const v = [
    [0, 0, 0],
    [x, 0, 0],
    [x, y, 0],
    [0, y, 0],
    [0, 0, z],
    [x, 0, z],
    [x, y, z],
    [0, y, z],
  ];
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
    [4, 5, 6],
    [4, 6, 7],
    [0, 1, 5],
    [0, 5, 4],
    [1, 2, 6],
    [1, 6, 5],
    [2, 3, 7],
    [2, 7, 6],
    [3, 0, 4],
    [3, 4, 7],
  ];
  const buf = Buffer.alloc(84 + faces.length * 50);
  buf.writeUInt32LE(faces.length, 80);
  faces.forEach((f, i) => {
    const off = 84 + i * 50 + 12;
    f.forEach((vi, k) => v[vi]!.forEach((c, j) => buf.writeFloatLE(c, off + k * 12 + j * 4)));
  });
  return buf;
}

/** Collect page errors and console errors (ignoring the hydration note Playwright's caret hiding causes). */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/hydrated but some attributes|caret-color/.test(m.text()))
      errors.push(m.text());
  });
  return errors;
}

/** Look up a catalog string so selectors follow the same copy users see, in every locale. */
export function msg(locale: string, key: string): string {
  const [ns, ...path] = key.split(".");
  const tree = JSON.parse(
    readFileSync(
      new URL(`../../../packages/i18n/messages/${locale}/${ns}.json`, import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
  const value = path.reduce<unknown>((node, p) => (node as Record<string, unknown>)?.[p], tree);
  if (typeof value !== "string") throw new Error(`missing catalog key ${locale}:${key}`);
  return value;
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const exact = (s: string) => new RegExp(`^${escapeRe(s)}$`);

/**
 * Phone layouts must never scroll sideways (UX_ARCHITECTURE §10). Checks every element: anything past
 * either viewport edge must sit inside a horizontal scroll/clip container (wide tables, tab rows).
 * Measured against the device width: on mobile, an over-wide page widens the layout viewport (and
 * zooms out) instead of scrolling, so window.innerWidth would hide the problem.
 */
export async function expectNoHorizontalOverflow(page: Page) {
  const device = page.viewportSize()!.width;
  const layout = await page.evaluate(() => window.innerWidth);
  expect(
    layout,
    `layout viewport grew to ${layout}px on a ${device}px screen (page too wide)`,
  ).toBeLessThanOrEqual(device);
  const offenders = await page.evaluate((w) => {
    const contained = (el: Element) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(a).overflowX))
          return true;
      }
      return false;
    };
    const out: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).position === "fixed") continue;
      if ((r.left < -1 || r.right > w + 1) && !contained(el))
        out.push(
          `${el.tagName.toLowerCase()} [${Math.round(r.left)}, ${Math.round(r.right)}] "${(el.textContent ?? "").trim().slice(0, 40)}"`,
        );
    }
    return out.slice(0, 5);
  }, device);
  expect(offenders, "elements overflow the viewport horizontally").toEqual([]);
}
