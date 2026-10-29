"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { disputes, drafts, orders, payments, quotes } from "@mfg/core";
import { run } from "@/lib/actions";
import { deps } from "@/lib/platform";
import { ctxFor, requireActor } from "@/lib/session";

async function customerCtx(locale: string) {
  return ctxFor(await requireActor("customer", locale));
}

export async function requoteAction(
  orderId: string,
  locale: string,
  opts: { quantity?: number; urgency?: "standard" | "fast" | "urgent" },
) {
  return run(async () => {
    const parsed = z
      .object({
        quantity: z.number().int().min(1).max(500).optional(),
        urgency: z.enum(["standard", "fast", "urgent"]).optional(),
      })
      .parse(opts);
    return quotes.requoteWithOptions(deps(), await customerCtx(locale), orderId, parsed);
  });
}

const addressSchema = z.object({
  recipientName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().max(12).optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function checkoutAction(
  orderId: string,
  locale: string,
  address: unknown,
  idempotencyKey: string,
) {
  const result = await run(async () =>
    payments.startCheckout(deps(), await customerCtx(locale), orderId, {
      address: addressSchema.parse(address),
      idempotencyKey: z.string().min(8).max(80).parse(idempotencyKey),
      locale,
    }),
  );
  if (!result.ok) return result;
  redirect(result.data.checkoutUrl);
}

export async function sendMessageAction(orderId: string, locale: string, body: string) {
  return run(async () =>
    orders.addOrderMessage(await customerCtx(locale), orderId, { body, visibility: "customer" }),
  );
}

export async function cancelOrderAction(orderId: string, locale: string, reason: string) {
  return run(async () =>
    payments.cancelOrder(
      deps(),
      await customerCtx(locale),
      orderId,
      reason.slice(0, 300) || "customer_request",
    ),
  );
}

export async function reportProblemAction(orderId: string, locale: string, description: string) {
  return run(async () =>
    disputes.reportProblem(await customerCtx(locale), orderId, { description }),
  );
}

export async function reorderAction(orderId: string, locale: string) {
  const draft = await drafts.reorderFrom(await customerCtx(locale), orderId);
  redirect(`/${locale}/new/${draft.id}`);
}
