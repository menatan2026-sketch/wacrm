import type { CreatePaymentInput, PaymentProvider, PaymentWebhookEvent } from "../ports";
import { hmac, randomToken, safeEqual } from "../shared/crypto";

/**
 * Development/pilot payment provider. Simulates a hosted payment page (served by the web app at
 * /dev/pay/[ref]) and signs its webhooks with PAYMENT_WEBHOOK_SECRET exactly like a real PSP would.
 * Not for production card processing: a certified Israeli PSP adapter is required (KNOWN_ISSUES KI-007).
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";
  private readonly status = new Map<string, "pending" | "captured" | "failed">();

  constructor(
    private readonly appUrl: string,
    private readonly webhookSecret: string,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<{ providerRef: string; checkoutUrl: string }> {
    const providerRef = `fk_${randomToken(12)}`;
    this.status.set(providerRef, "pending");
    return { providerRef, checkoutUrl: `${this.appUrl}/${input.locale}/dev/pay/${providerRef}` };
  }

  async getPaymentStatus(providerRef: string) {
    return this.status.get(providerRef) ?? "pending";
  }

  async refundPayment(input: { providerRef: string; amountMinor: number }): Promise<{ refundRef: string }> {
    return { refundRef: `fkr_${randomToken(10)}_${input.amountMinor}` };
  }

  sign(body: string): string {
    return hmac(this.webhookSecret, body);
  }

  /** Build the signed webhook the hosted page would send (used by the dev pay page and tests). */
  buildWebhook(event: PaymentWebhookEvent): { body: string; headers: Record<string, string> } {
    const body = JSON.stringify(event);
    return { body, headers: { "x-fake-signature": this.sign(body) } };
  }

  parseWebhook(rawBody: string, headers: Record<string, string | undefined>): PaymentWebhookEvent | null {
    const sig = headers["x-fake-signature"];
    if (!sig || !safeEqual(sig, this.sign(rawBody))) return null;
    try {
      const e = JSON.parse(rawBody) as PaymentWebhookEvent;
      if (e.type === "payment.captured") this.status.set(e.providerRef, "captured");
      if (e.type === "payment.failed") this.status.set(e.providerRef, "failed");
      return e;
    } catch {
      return null;
    }
  }
}

export function isFakePaymentProvider(p: PaymentProvider): p is FakePaymentProvider {
  return p.name === "fake" && typeof (p as Partial<FakePaymentProvider>).buildWebhook === "function";
}
