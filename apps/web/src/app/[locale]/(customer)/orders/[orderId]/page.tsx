import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DomainError, orders, payments, quotes, shipping, catalog } from "@mfg/core";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@mfg/i18n";
import {
  Banner,
  Card,
  Ltr,
  ORDER_TONE,
  StatusChip,
  TechPanel,
  Timeline,
  type TimelineStage,
} from "@mfg/ui";
import { catalogName, isolate, resolveLocale } from "@/lib/i18n";
import { ctxFor, requireActor } from "@/lib/session";
import { OrderActions, QuotePanel, MessagesPanel } from "./OrderClient";

const STAGES = [
  "requirements",
  "quote",
  "payment",
  "production",
  "qc",
  "shipping",
  "delivered",
] as const;
const STAGE_OF: Record<string, number> = {
  DRAFT: 0,
  REQUIREMENTS_PENDING: 0,
  REVIEW_REQUIRED: 0,
  DESIGN_REQUIRED: 0,
  DESIGN_IN_PROGRESS: 0,
  DESIGN_APPROVAL: 0,
  QUOTE_READY: 1,
  PAYMENT_PENDING: 2,
  PAID: 3,
  ROUTING: 3,
  SUPPLIER_ASSIGNED: 3,
  SUPPLIER_ACCEPTED: 3,
  PRODUCTION: 3,
  QC_PENDING: 4,
  QC_FAILED: 4,
  REPRINT_REQUIRED: 4,
  READY_FOR_SHIPMENT: 5,
  SHIPPED: 5,
  DELIVERED: 6,
  COMPLETED: 7,
  DISPUTED: 6,
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>;
}) {
  const locale = await resolveLocale(params);
  const { orderId } = await params;
  const actor = await requireActor("customer", locale, `/${locale}/orders/${orderId}`);
  const ctx = await ctxFor(actor);
  const t = await getTranslations("orders");
  const tq = await getTranslations("quotes");
  const tp = await getTranslations("payments");
  const ts = await getTranslations("shipping");
  const tc = await getTranslations("common");
  const tm = await getTranslations("manufacturing");
  let order;
  try {
    order = await orders.getOrderForActor(ctx, orderId);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const [items, quote, docs, shipments, messages, history, mats] = await Promise.all([
    orders.orderItems(ctx, orderId),
    quotes.currentQuote(ctx, orderId),
    payments.documentsForOrder(ctx, orderId),
    shipping.shipmentsForOrder(ctx, orderId),
    orders.orderMessages(ctx, orderId),
    orders.orderHistory(ctx, orderId),
    catalog.listMaterials(ctx),
  ]);
  const status = order.status as keyof typeof STAGE_OF;
  const current = STAGE_OF[status] ?? 0;
  const terminalBad = status === "CANCELLED" || status === "REFUNDED";
  const reachedAt = (idx: number) => {
    const s = history.find((h) => (STAGE_OF[h.toStatus] ?? -1) >= idx);
    return s ? formatDate(s.at, locale) : undefined;
  };
  const stages: TimelineStage[] = STAGES.map((key, i) => ({
    key,
    label: t(`detail.stages.${key}`),
    state: terminalBad
      ? i < current
        ? "done"
        : "upcoming"
      : i < current
        ? "done"
        : i === current
          ? status === "QC_FAILED" || status === "REPRINT_REQUIRED" || status === "DISPUTED"
            ? "exception"
            : "current"
          : "upcoming",
    meta:
      i < current
        ? reachedAt(i + 1)
        : i === current && key === "shipping" && order.promisedShipDate
          ? t("detail.shipBy", { date: formatDate(order.promisedShipDate, locale) })
          : undefined,
  }));
  const item = items[0];
  const variant = mats
    .flatMap((m) => m.variants.map((v) => ({ v, m })))
    .find((x) => x.v.id === item?.materialVariantId);
  const quoteReady =
    quote &&
    quote.quote.status === "ready" &&
    (status === "QUOTE_READY" || status === "PAYMENT_PENDING");
  const cancellable = [
    "DRAFT",
    "REQUIREMENTS_PENDING",
    "REVIEW_REQUIRED",
    "DESIGN_REQUIRED",
    "DESIGN_IN_PROGRESS",
    "DESIGN_APPROVAL",
    "QUOTE_READY",
    "PAYMENT_PENDING",
    "PAID",
    "ROUTING",
    "SUPPLIER_ASSIGNED",
    "SUPPLIER_ACCEPTED",
  ].includes(status);
  const paid = Boolean(order.paidAt);
  const req = item?.requirements as { qualityProfile?: string } | undefined;

  return (
    <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 md:px-8 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-7">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold">
            {t("detail.title", { number: isolate(order.orderNumber) })}
          </h1>
          <StatusChip
            tone={ORDER_TONE[status] ?? "neutral"}
            label={t(`status.${status as "DRAFT"}`)}
          />
        </div>
        <Card className="flex flex-col gap-2 border-primary/30">
          <h2 className="text-sm font-semibold text-text-secondary">{t("detail.next")}</h2>
          <p className="text-lg">{order.onHold ? t("onHold") : t(`next.${status as "DRAFT"}`)}</p>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">{t("detail.timeline")}</h2>
          <Timeline label={t("detail.timeline")} stages={stages} />
        </Card>
        {quoteReady && (
          <QuotePanel
            orderId={orderId}
            locale={locale}
            quantity={item?.quantity ?? 1}
            urgency={order.urgencyTier as "standard"}
            total={formatMoney(quote.snapshot.totalMinor, quote.snapshot.currency, locale)}
            lines={quote.snapshot.lines.map((l) => ({
              label: tq(l.labelKey.replace("quotes.", "") as "lines.manufacturing"),
              amount: formatMoney(l.amountNetMinor, quote.snapshot.currency, locale),
            }))}
            vat={{
              label: tq("vat", { rate: formatPercent(quote.snapshot.taxRateBps / 10000, locale) }),
              amount: formatMoney(quote.snapshot.taxMinor, quote.snapshot.currency, locale),
            }}
            validUntil={tq("validUntil", { date: formatDate(quote.quote.expiresAt, locale) })}
            canChange={order.flow === "file"}
          />
        )}
        {shipments.map((s) => (
          <Card key={s.id} className="flex flex-col gap-3">
            <h2 className="font-semibold">{t("detail.tracking")}</h2>
            <p className="text-sm text-text-secondary">
              {s.carrier} ·{" "}
              {t("detail.trackingNumber", { number: isolate(s.trackingNumber ?? "") })}
            </p>
            <ol className="flex flex-col gap-1 text-sm">
              {s.events.map((e) => (
                <li key={e.id} className="flex justify-between gap-4">
                  <span>{ts(`status.${e.status as "DELIVERED"}`)}</span>
                  <span className="text-text-secondary">{formatDate(e.at, locale)}</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
        <MessagesPanel
          orderId={orderId}
          locale={locale}
          messages={messages.map((m) => ({
            id: m.id,
            mine: m.authorType === "customer",
            body: m.body,
            at: formatDate(m.createdAt, locale),
          }))}
        />
      </div>
      <aside className="flex flex-col gap-4 lg:col-span-5">
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">
            {order.flow === "file" ? t("detail.part") : t("detail.request")}
          </h2>
          {item && order.flow === "file" && (
            <TechPanel className="flex flex-col gap-1 text-sm">
              <span>
                {variant
                  ? `${catalogName(variant.m.i18n, locale, variant.m.code)} · ${catalogName(variant.v.i18n, locale, variant.v.colorCode)}`
                  : "—"}
              </span>
              {req?.qualityProfile && (
                <span className="text-text-secondary">
                  {tm(`quality.${req.qualityProfile as "standard"}`)}
                </span>
              )}
              <span className="text-text-secondary">
                {t("detail.quantity", { n: formatNumber(item.quantity, locale, 0) })}
              </span>
            </TechPanel>
          )}
          {order.request.description && (
            <p className="whitespace-pre-wrap text-sm text-text-secondary">
              {order.request.description}
            </p>
          )}
        </Card>
        {docs.length > 0 && (
          <Card className="flex flex-col gap-2">
            <h2 className="font-semibold">{t("detail.documents")}</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {docs.map((d) => (
                <li key={d.id} className="flex justify-between gap-4">
                  <span>
                    {tp(`documents.${d.kind as "receipt"}`, { number: d.documentNumber })}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(d.totalMinor, d.currency, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {order.onHold && <Banner tone="warning">{t("onHold")}</Banner>}
        <OrderActions
          orderId={orderId}
          locale={locale}
          cancellable={cancellable}
          paid={paid}
          canReport={["PRODUCTION", "QC_PENDING", "SHIPPED", "DELIVERED"].includes(status)}
          canReorder={order.flow === "file" && ["DELIVERED", "COMPLETED"].includes(status)}
        />
        <p className="text-xs text-text-tertiary">
          {tc("reference")}: <Ltr mono>{order.id.slice(0, 8)}</Ltr>
        </p>
      </aside>
    </div>
  );
}
