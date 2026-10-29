import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PresignedUpload, StorageProvider } from "../ports";
import { signPayload, verifyPayload } from "../shared/crypto";

interface UploadClaim extends Record<string, unknown> {
  k: string;
  ct: string;
  n: number;
  exp: number;
  op: "put";
}
interface DownloadClaim extends Record<string, unknown> {
  k: string;
  fn: string;
  exp: number;
  op: "get";
}

const SAFE_KEY = /^[a-z0-9_]+\/\d{4}\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/;

/**
 * Filesystem storage for local development and tests. Emulates presigned URLs with short-lived
 * HMAC tokens served by the web app's /api/storage routes, so the upload flow matches S3.
 */
export class LocalStorage implements StorageProvider {
  constructor(
    private readonly root: string,
    private readonly appUrl: string,
    private readonly secret: string,
  ) {}

  private resolve(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error(`unsafe storage key: ${key}`);
    return path.join(this.root, key);
  }

  async presignUpload(key: string, contentType: string, contentLength: number, expiresInSeconds: number): Promise<PresignedUpload> {
    this.resolve(key);
    const exp = Date.now() + expiresInSeconds * 1000;
    const token = signPayload(this.secret, { k: key, ct: contentType, n: contentLength, exp, op: "put" } satisfies UploadClaim);
    return { url: `${this.appUrl}/api/storage/upload?token=${encodeURIComponent(token)}`, method: "PUT", headers: { "content-type": contentType }, expiresAt: new Date(exp) };
  }

  async presignDownload(key: string, fileName: string, expiresInSeconds: number): Promise<string> {
    this.resolve(key);
    const token = signPayload(this.secret, { k: key, fn: fileName, exp: Date.now() + expiresInSeconds * 1000, op: "get" } satisfies DownloadClaim);
    return `${this.appUrl}/api/storage/download?token=${encodeURIComponent(token)}`;
  }

  verifyUpload(token: string): UploadClaim | null {
    const claim = verifyPayload<UploadClaim>(this.secret, token);
    return claim && claim.op === "put" && claim.exp > Date.now() ? claim : null;
  }

  verifyDownload(token: string): DownloadClaim | null {
    const claim = verifyPayload<DownloadClaim>(this.secret, token);
    return claim && claim.op === "get" && claim.exp > Date.now() ? claim : null;
  }

  async head(key: string): Promise<{ size: number } | null> {
    try {
      return { size: (await stat(this.resolve(key))).size };
    } catch {
      return null;
    }
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
