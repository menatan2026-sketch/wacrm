/** External dependencies as ports (ADR-0011). Every port has a fake for tests and local dev. */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  template: string;
  locale: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export interface PresignedUpload {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StorageProvider {
  presignUpload(key: string, contentType: string, contentLength: number, expiresInSeconds: number): Promise<PresignedUpload>;
  presignDownload(key: string, fileName: string, expiresInSeconds: number): Promise<string>;
  head(key: string): Promise<{ size: number } | null>;
  get(key: string): Promise<Buffer>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface GeometryMetrics {
  units_detected: "mm" | "in" | "unknown";
  bbox_mm: [number, number, number];
  volume_mm3: number;
  surface_area_mm2: number;
  overhang_area_mm2: number;
  triangle_count: number;
  shells: number;
  is_watertight: boolean;
}

export type GeometryResult =
  | {
      ok: true;
      analyzer_version: string;
      duration_ms: number;
      stages: { stage: string; status: "done" | "failed" }[];
      metrics: GeometryMetrics;
      warnings: string[];
      preview_glb_b64: string | null;
    }
  | {
      ok: false;
      analyzer_version: string;
      duration_ms: number;
      stages: { stage: string; status: "done" | "failed" }[];
      failure_code: string;
    };

export interface GeometryClient {
  analyze(fileName: string, bytes: Buffer): Promise<GeometryResult>;
}

export interface CreatePaymentInput {
  paymentId: string;
  amountMinor: number;
  currency: string;
  description: string;
  locale: string;
  returnUrl: string;
  idempotencyKey: string;
}

export interface PaymentWebhookEvent {
  providerEventId: string;
  type: "payment.captured" | "payment.failed" | "refund.completed";
  providerRef: string;
  amountMinor: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<{ providerRef: string; checkoutUrl: string }>;
  getPaymentStatus(providerRef: string): Promise<"pending" | "captured" | "failed">;
  refundPayment(input: { providerRef: string; amountMinor: number; idempotencyKey: string }): Promise<{ refundRef: string }>;
  /** Verify the signature and parse the body. Returns null when the signature is invalid. */
  parseWebhook(rawBody: string, headers: Record<string, string | undefined>): PaymentWebhookEvent | null;
}

export interface ShipmentRequest {
  orderNumber: string;
  serviceLevel: string;
  recipient: { name: string; phone: string; line1: string; line2?: string | null; city: string; postalCode?: string | null };
  from: { name: string; city: string; line1: string };
}

export interface ShippingProvider {
  readonly name: string;
  readonly automatic: boolean;
  createShipment(input: ShipmentRequest): Promise<{ carrier: string; trackingNumber: string; trackingUrl: string | null; costMinor: number }>;
  trackShipment(trackingNumber: string): Promise<{ status: string; providerEventId: string; description: string; at: Date }[]>;
}

export interface InvoiceProvider {
  readonly name: string;
  /** Issue a document and return its number. MVP: internal register (not a certified tax document). */
  issue(input: { kind: "receipt" | "credit_note"; sequence: number; orderNumber: string }): Promise<{ documentNumber: string }>;
}
