import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export const sha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

export const hmac = (secret: string, value: string): string =>
  createHmac("sha256", secret).update(value).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** URL-safe random token with `bytes` bytes of entropy. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

export const randomDigits = (length: number): string =>
  Array.from({ length }, () => randomInt(0, 10).toString()).join("");

function key(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "mfg", purpose, 32));
}

/** AES-256-GCM for small secrets at rest (e.g. TOTP seeds). Key derived per purpose from APP_SECRET. */
export function seal(secret: string, purpose: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret, purpose), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function unseal(secret: string, purpose: string, sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !body) throw new Error("malformed sealed value");
  const decipher = createDecipheriv("aes-256-gcm", key(secret, purpose), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/** Compact signed token: base64url(json).hmac — for upload URLs and share links. */
export function signPayload(secret: string, payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(secret, body)}`;
}

export function verifyPayload<T extends Record<string, unknown>>(
  secret: string,
  token: string,
): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, hmac(secret, body))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
