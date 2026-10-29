import type { Db } from "@mfg/db";
import type { RateLimiter } from "./platform/rate-limit";
import type { EmailSender, GeometryClient, InvoiceProvider, PaymentProvider, ShippingProvider, StorageProvider } from "./ports";
import type { Clock } from "./shared/context";

/** Everything the application layer needs from the outside world, wired once per process. */
export interface Deps {
  db: Db;
  secret: string;
  appUrl: string;
  email: EmailSender;
  storage: StorageProvider;
  geometry: GeometryClient;
  payments: PaymentProvider;
  shipping: ShippingProvider;
  invoices: InvoiceProvider;
  rateLimiter: RateLimiter;
  clock: Clock;
  limits: { maxModelBytes: number; maxPhotoBytes: number };
}
