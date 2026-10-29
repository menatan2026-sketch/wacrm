import { schema, uuidv7, and, desc, eq, isNull } from "@mfg/db";
import { formatDate, formatMoney, isLocale, type AppLocale } from "@mfg/i18n";
import type { Deps } from "../../deps";
import type { Ctx } from "../../shared/context";
import { renderEmail } from "./email";
import { requireUser } from "../identity/rbac";

type Vars = Record<string, string | number>;

async function deliver(
  d: Deps,
  ctx: Ctx,
  to: { userId: string | null; email: string; locale: string },
  template: string,
  vars: Vars,
  link?: string,
) {
  const locale: AppLocale = isLocale(to.locale) ? to.locale : "he";
  await ctx.db.insert(schema.notifications).values({
    id: uuidv7(),
    userId: to.userId,
    kind: template,
    channel: "in_app",
    locale,
    payload: { ...vars, link: link ?? null },
    status: "sent",
    sentAt: ctx.clock.now(),
  });
  await d.email.send({ to: to.email, ...renderEmail(template, locale, vars) });
}

/** Customer notification for an order event, in the customer's preferred language. */
export async function notifyCustomer(
  d: Deps,
  ctx: Ctx,
  input: { orderId: string; template: string; vars?: Record<string, unknown> },
) {
  const [row] = await ctx.db
    .select({ order: schema.orders, user: schema.users })
    .from(schema.orders)
    .innerJoin(schema.users, eq(schema.users.id, schema.orders.customerUserId))
    .where(eq(schema.orders.id, input.orderId));
  if (!row) return;
  const locale = (
    isLocale(row.user.preferredLocale) ? row.user.preferredLocale : "he"
  ) as AppLocale;
  const link = `${d.appUrl}/${locale}/orders/${row.order.id}`;
  const vars: Vars = { order: row.order.orderNumber, link };
  if (input.template === "quote_ready" || input.template === "payment_succeeded") {
    const [q] = await ctx.db
      .select({
        total: schema.quoteSnapshots.totalMinor,
        currency: schema.quoteSnapshots.currency,
        expiresAt: schema.quotes.expiresAt,
      })
      .from(schema.quotes)
      .innerJoin(schema.quoteSnapshots, eq(schema.quoteSnapshots.quoteId, schema.quotes.id))
      .where(
        eq(schema.quotes.id, row.order.currentQuoteId ?? "00000000-0000-0000-0000-000000000000"),
      );
    if (!q) return;
    vars.total = formatMoney(q.total, q.currency, locale);
    vars.expires = formatDate(q.expiresAt, locale);
  }
  if (input.template === "order_delayed")
    vars.date = formatDate(String(input.vars?.shipDate ?? row.order.promisedShipDate), locale);
  if (input.template === "refund_completed")
    vars.amount = formatMoney(Number(input.vars?.amountMinor ?? 0), row.order.currency, locale);
  if (input.template === "shipped") {
    vars.carrier = String(input.vars?.carrier ?? "");
    vars.tracking = String(input.vars?.tracking ?? "");
  }
  if (input.template === "customer_message") vars.message = String(input.vars?.message ?? "");
  await deliver(
    d,
    ctx,
    { userId: row.user.id, email: row.user.email, locale },
    input.template,
    vars,
    link,
  );
}

async function supplierRecipients(ctx: Ctx, supplierId: string) {
  return ctx.db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      locale: schema.users.preferredLocale,
    })
    .from(schema.roleAssignments)
    .innerJoin(schema.users, eq(schema.users.id, schema.roleAssignments.userId))
    .where(
      and(
        eq(schema.roleAssignments.scopeType, "supplier"),
        eq(schema.roleAssignments.scopeId, supplierId),
        isNull(schema.roleAssignments.revokedAt),
      ),
    );
}

/** New offer to every user of the supplier (no customer data — only job facts). */
export async function notifySupplierOffer(d: Deps, ctx: Ctx, offerId: string) {
  const [row] = await ctx.db
    .select({ offer: schema.jobOffers, job: schema.productionJobs, material: schema.materials })
    .from(schema.jobOffers)
    .innerJoin(schema.productionJobs, eq(schema.productionJobs.id, schema.jobOffers.jobId))
    .innerJoin(schema.orderItems, eq(schema.orderItems.orderId, schema.productionJobs.orderId))
    .leftJoin(
      schema.materialVariants,
      eq(schema.materialVariants.id, schema.orderItems.materialVariantId),
    )
    .leftJoin(schema.materials, eq(schema.materials.id, schema.materialVariants.materialId))
    .where(eq(schema.jobOffers.id, offerId));
  if (!row) return;
  for (const r of await supplierRecipients(ctx, row.offer.supplierId)) {
    const locale = (isLocale(r.locale) ? r.locale : "he") as AppLocale;
    const link = `${d.appUrl}/${locale}/partners/offers`;
    await deliver(
      d,
      ctx,
      { userId: r.id, email: r.email, locale },
      "offer_received",
      {
        material: row.material?.code ?? "",
        due: row.job.dueAt ? formatDate(row.job.dueAt, locale) : "",
        payout: formatMoney(row.offer.payoutMinor, row.job.currency, locale),
        expires: formatDate(row.offer.expiresAt, locale),
        link,
      },
      link,
    );
  }
}

export async function notifySupplierJob(
  d: Deps,
  ctx: Ctx,
  input: { jobId: string; template: string; vars?: Record<string, unknown> },
) {
  const [job] = await ctx.db
    .select()
    .from(schema.productionJobs)
    .where(eq(schema.productionJobs.id, input.jobId));
  if (!job?.supplierId) return;
  for (const r of await supplierRecipients(ctx, job.supplierId)) {
    const locale = (isLocale(r.locale) ? r.locale : "he") as AppLocale;
    const link = `${d.appUrl}/${locale}/partners/jobs/${job.id}`;
    await deliver(
      d,
      ctx,
      { userId: r.id, email: r.email, locale },
      input.template,
      { job: job.id.slice(0, 8), reason: String(input.vars?.reason ?? ""), link },
      link,
    );
  }
}

export async function notifyEmail(
  d: Deps,
  input: { to: string; locale: string; template: string; vars: Vars },
) {
  await d.email.send({ to: input.to, ...renderEmail(input.template, input.locale, input.vars) });
}

export async function myNotifications(ctx: Ctx) {
  const user = requireUser(ctx.actor);
  return ctx.db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50);
}
