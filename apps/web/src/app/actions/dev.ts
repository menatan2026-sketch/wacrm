"use server";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { isFakePaymentProvider, payments } from "@mfg/core";
import { deps } from "@/lib/platform";

/**
 * Fake PSP: produce a correctly signed webhook and deliver it to the real webhook handler, exactly
 * as an external provider would. Disabled unless the fake provider is configured.
 */
export async function devPayAction(
  providerRef: string,
  outcome: "approve" | "decline",
  locale: string,
) {
  const d = deps();
  if (!isFakePaymentProvider(d.payments)) throw new Error("fake payments disabled");
  const payment = await payments.findPaymentByRef(d, providerRef);
  if (!payment) throw new Error("unknown payment");
  const hook = d.payments.buildWebhook({
    providerEventId: `dev-${randomUUID()}`,
    type: outcome === "approve" ? "payment.captured" : "payment.failed",
    providerRef,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
  });
  await payments.handlePaymentWebhook(d, hook.body, hook.headers);
  redirect(`/${locale}/orders/${payment.orderId}`);
}
