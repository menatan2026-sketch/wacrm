"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  disputes,
  flags,
  orders,
  payments,
  payouts,
  pricingAdmin,
  production,
  quotes,
  routing,
  shipping,
  suppliers,
} from "@mfg/core";
import { parseDecimal } from "@mfg/i18n";
import { run } from "@/lib/actions";
import { opsContext } from "@/lib/ops";
import { deps } from "@/lib/platform";

/** Form values arrive as strings from the generic ops form; every action re-validates them. */
type Values = Record<string, string>;

const reason = z.string().trim().min(3).max(500);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);
/** "123.45" (₪, comma or dot) → 12345 minor units. */
const money = z.string().transform((v, c) => {
  const n = parseDecimal(v);
  if (n === null || n < 0) {
    c.addIssue({ code: "custom", message: "amount" });
    return z.NEVER;
  }
  return Math.round(n * 100);
});
const optionalMoney = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(money.optional());
const bool = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

function done(locale: string, path: string) {
  revalidatePath(`/${locale}/ops${path}`);
}

export async function manualQuoteAction(locale: string, orderId: string, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    const v = z
      .object({
        manufacturingNet: optionalMoney,
        designFee: optionalMoney,
        includeShipping: bool,
        materialVariantId: z
          .uuid()
          .optional()
          .or(z.literal("").transform(() => undefined)),
        reason,
      })
      .parse(values);
    await quotes.manualQuote(deps(), ctx, orderId, {
      manufacturingNetMinor: v.manufacturingNet,
      designFeeNetMinor: v.designFee,
      includeShipping: v.includeShipping,
      materialVariantId: v.materialVariantId,
      reason: v.reason,
    });
    done(locale, `/orders/${orderId}`);
  });
}

export async function proposeRoutingAction(locale: string, orderId: string) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await routing.proposeRouting(deps(), ctx, orderId);
    done(locale, `/orders/${orderId}`);
  });
}

export async function offerAction(
  locale: string,
  orderId: string,
  supplierId: string,
  mode: "manual_confirmed" | "manual_override",
  values: Values,
) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    const v = z
      .object({ reason: mode === "manual_override" ? reason : optionalText(500) })
      .parse(values);
    await routing.offerToSupplier(deps(), ctx, orderId, z.uuid().parse(supplierId), mode, v.reason);
    done(locale, `/orders/${orderId}`);
  });
}

export async function holdAction(locale: string, orderId: string, onHold: boolean, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await orders.setHold(ctx, orderId, onHold, reason.parse(values.reason));
    done(locale, `/orders/${orderId}`);
  });
}

export async function messageAction(locale: string, orderId: string, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    const v = z.object({ body: z.string().trim().min(1).max(4000), internal: bool }).parse(values);
    await orders.addOrderMessage(ctx, orderId, {
      body: v.body,
      visibility: v.internal ? "internal" : "customer",
    });
    done(locale, `/orders/${orderId}`);
  });
}

export async function shipAction(
  locale: string,
  orderId: string,
  mode: "provider" | "manual",
  values: Values,
) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    if (mode === "provider")
      await shipping.createShipment(deps(), ctx, orderId, { mode: "provider" });
    else {
      const v = shipping.manualShipmentSchema.parse({
        carrier: values.carrier,
        trackingNumber: values.trackingNumber,
        trackingUrl: values.trackingUrl || undefined,
      });
      await shipping.createShipment(deps(), ctx, orderId, { mode: "manual", ...v });
    }
    done(locale, `/orders/${orderId}`);
  });
}

export async function markDeliveredAction(locale: string, orderId: string, shipmentId: string) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await shipping.recordShipmentStatus(
      ctx,
      z.uuid().parse(shipmentId),
      "DELIVERED",
      `manual:${shipmentId}:delivered`,
      "manual",
    );
    done(locale, `/orders/${orderId}`);
  });
}

const REFUND_REASONS = ["quality", "late", "cancellation", "goodwill", "dispute", "other"] as const;

export async function refundAction(locale: string, orderId: string, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    const v = z
      .object({
        amount: money.pipe(z.number().int().positive()),
        reasonCode: z.enum(REFUND_REASONS),
        note: optionalText(500),
      })
      .parse(values);
    await payments.requestRefund(deps(), ctx, orderId, {
      amountMinor: v.amount,
      reasonCode: v.reasonCode,
      note: v.note,
    });
    done(locale, `/orders/${orderId}`);
  });
}

export async function approveRefundAction(locale: string, refundId: string) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await payments.approveRefund(deps(), ctx, z.uuid().parse(refundId));
    done(locale, "/payments");
  });
}

export async function resolveDisputeAction(
  locale: string,
  orderId: string,
  resolution: "refund" | "reprint" | "close",
  values: Values,
) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    const v = z
      .object({ reason, costBearer: z.enum(["supplier", "platform"]).optional() })
      .parse(values);
    await disputes.resolveDispute(deps(), ctx, orderId, {
      resolution,
      reason: v.reason,
      costBearer: v.costBearer,
    });
    done(locale, `/orders/${orderId}`);
  });
}

export async function concessionAction(
  locale: string,
  orderId: string,
  jobId: string,
  values: Values,
) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await production.acceptWithConcession(ctx, z.uuid().parse(jobId), reason.parse(values.reason));
    done(locale, `/orders/${orderId}`);
  });
}

export async function qcVerdictAction(
  locale: string,
  jobId: string,
  verdict: "pass" | "fail" | "needs_info",
  values: Values,
) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    const defects =
      verdict === "fail" && values.defect
        ? [
            {
              code: values.defect,
              severity: values.severity || "major",
              description: values.notes || undefined,
            },
          ]
        : [];
    await production.reviewQc(ctx, z.uuid().parse(jobId), {
      verdict,
      defects,
      notes: values.notes || undefined,
    });
    done(locale, `/qc/${jobId}`);
  });
}

export async function reprintAction(locale: string, jobId: string, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    const newJobId = await production.orderReprint(ctx, z.uuid().parse(jobId), {
      reasonCode: values.reasonCode,
      costBearer: values.costBearer,
      rootCause: values.rootCause || undefined,
    });
    done(locale, "/qc");
    return newJobId;
  });
}

export async function inviteSupplierAction(locale: string, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    const v = z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z.email().max(254),
        locale: z.enum(["he", "en", "ru"]),
      })
      .parse(values);
    const r = await suppliers.inviteSupplier(deps(), ctx, {
      name: v.name,
      contactEmail: v.email,
      locale: v.locale,
    });
    done(locale, "/suppliers");
    return { inviteLink: r.inviteLink };
  });
}

export async function supplierStatusAction(
  locale: string,
  supplierId: string,
  status: "active" | "paused" | "suspended",
  values: Values,
) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await suppliers.setSupplierStatus(
      ctx,
      z.uuid().parse(supplierId),
      status,
      reason.parse(values.reason),
    );
    done(locale, "/suppliers");
  });
}

export async function ruleDraftAction(locale: string, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    let parsed: unknown;
    try {
      parsed = JSON.parse(values.rules ?? "");
    } catch {
      throw new z.ZodError([
        { code: "custom", path: ["rules"], message: "json", input: values.rules },
      ]);
    }
    await pricingAdmin.createRuleSetDraft(ctx, parsed);
    done(locale, "/pricing");
  });
}

export async function activateRuleAction(locale: string, ruleSetId: string, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await pricingAdmin.activateRuleSet(ctx, z.uuid().parse(ruleSetId), reason.parse(values.reason));
    done(locale, "/pricing");
  });
}

export async function closeStatementAction(locale: string, supplierId: string) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await payouts.closeStatement(ctx, z.uuid().parse(supplierId), ctx.clock.now());
    done(locale, "/payouts");
  });
}

export async function markPaidAction(locale: string, statementId: string, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await payouts.markStatementPaid(
      ctx,
      z.uuid().parse(statementId),
      z.string().trim().min(3).max(120).parse(values.reference),
    );
    done(locale, "/payouts");
  });
}

export async function setFlagAction(locale: string, key: string, enabled: boolean, values: Values) {
  return run(async () => {
    const { ctx } = await opsContext(locale);
    await flags.setFlag(
      ctx,
      z.enum(flags.FLAG_KEYS).parse(key),
      enabled,
      reason.parse(values.reason),
    );
    done(locale, "/flags");
  });
}
