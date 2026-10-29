import { Redis } from "ioredis";
import path from "node:path";
import type { ServerConfig } from "@mfg/config";
import { createDb, createPool } from "@mfg/db";
import { HttpGeometryClient } from "./adapters/geometry";
import { InternalInvoiceProvider } from "./adapters/invoices-internal";
import { FakePaymentProvider } from "./adapters/payments-fake";
import { FakeShippingProvider, ManualShippingProvider } from "./adapters/shipping";
import { LocalStorage } from "./adapters/storage-local";
import { S3Storage } from "./adapters/storage-s3";
import type { Deps } from "./deps";
import { LogEmailSender, SmtpEmailSender } from "./modules/notifications/email";
import { RedisRateLimiter } from "./platform/rate-limit";
import { systemClock } from "./shared/context";

export interface Platform {
  deps: Deps;
  redis: Redis;
  close(): Promise<void>;
}

/** Composition root: wire real or development adapters from validated configuration. */
export function createPlatform(config: ServerConfig, opts: { rootDir?: string; poolSize?: number } = {}): Platform {
  const pool = createPool(config.DATABASE_URL, opts.poolSize ?? 10);
  const db = createDb(pool);
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false });
  const storage =
    config.STORAGE_DRIVER === "s3"
      ? new S3Storage(config.S3_BUCKET!, { region: config.S3_REGION, endpoint: config.S3_ENDPOINT, accessKeyId: config.S3_ACCESS_KEY_ID!, secretAccessKey: config.S3_SECRET_ACCESS_KEY!, forcePathStyle: config.S3_FORCE_PATH_STYLE })
      : new LocalStorage(path.resolve(opts.rootDir ?? process.cwd(), config.STORAGE_LOCAL_DIR), config.APP_URL, config.APP_SECRET);
  const deps: Deps = {
    db,
    secret: config.APP_SECRET,
    appUrl: config.APP_URL,
    email: config.EMAIL_DRIVER === "smtp" ? new SmtpEmailSender(config.SMTP_URL!, config.EMAIL_FROM, db) : new LogEmailSender(db),
    storage,
    geometry: new HttpGeometryClient(config.GEOMETRY_URL, config.GEOMETRY_SHARED_SECRET),
    payments: new FakePaymentProvider(config.APP_URL, config.PAYMENT_WEBHOOK_SECRET),
    shipping: config.SHIPPING_PROVIDER === "fake" ? new FakeShippingProvider() : new ManualShippingProvider(),
    invoices: new InternalInvoiceProvider(),
    rateLimiter: new RedisRateLimiter(redis),
    clock: systemClock,
    limits: { maxModelBytes: config.UPLOAD_MAX_MODEL_BYTES, maxPhotoBytes: config.UPLOAD_MAX_PHOTO_BYTES },
  };
  return {
    deps,
    redis,
    async close() {
      redis.disconnect();
      await pool.end();
    },
  };
}
