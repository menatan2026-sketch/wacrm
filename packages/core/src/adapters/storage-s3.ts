import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PresignedUpload, StorageProvider } from "../ports";

/** S3-compatible private bucket (AWS S3, MinIO, R2). Bucket must block public access. */
export class S3Storage implements StorageProvider {
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    opts: { region: string; endpoint?: string; accessKeyId: string; secretAccessKey: string; forcePathStyle: boolean },
  ) {
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,
      forcePathStyle: opts.forcePathStyle,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async presignUpload(key: string, contentType: string, contentLength: number, expiresInSeconds: number): Promise<PresignedUpload> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: contentLength });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return { url, method: "PUT", headers: { "content-type": contentType }, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }

  async presignDownload(key: string, fileName: string, expiresInSeconds: number): Promise<string> {
    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key, ResponseContentDisposition: disposition }), { expiresIn: expiresInSeconds });
  }

  async head(key: string): Promise<{ size: number } | null> {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: r.ContentLength ?? 0 };
    } catch {
      return null;
    }
  }

  async get(key: string): Promise<Buffer> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
