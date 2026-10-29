import { Download } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { admin, catalog, DomainError, rbac } from "@mfg/core";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@mfg/i18n";
import { Badge, Banner, Card, DataTable, JOB_TONE, Ltr, ORDER_TONE, SectionTitle, StatusChip } from "@mfg/ui";
import {
  concessionAction,
  holdAction,
  manualQuoteAction,
  markDeliveredAction,
  messageAction,
  offerAction,
  proposeRoutingAction,
  refundAction,
  resolveDisputeAction,
  shipAction,
} from "@/app/actions/ops";
import { ActionForm } from "@/components/ActionForm";
import { catalogName, useLocaleParam } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

const REFUND_REASONS = ["quality", "late", "cancellation", "goodwill", "dispute", "other"] as const;

function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>{title}</SectionTitle>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export default async function OpsOrder({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const locale = await useLocaleParam(params);
  const { orderId } = await params;
  const { actor, ctx } = await opsContext(locale, `/${locale}/ops/orders/${orderId}`);
  const t = await getTranslations("admin.order");
  const o = await getTranslations("orders");
  const r = await getTranslations("admin.reasons");
  const j = await getTranslations("supplier.job.status");
  const ship = await getTranslations("shipping.status");
  const d = await admin.orderDetail(ctx, orderId).catch((e) => {
    if (e instanceof DomainError) notFound();
    throw e;
  });
  const { order } = d;
  const can = (p: Parameters<typeof rbac.can>[1]) => rbac.can(actor, p);
  const reason = (code: string) => (r.has(code) ? r(code) : code);
  const money = (n: number) => formatMoney(n, d.quote?.snapshot.currency ?? "ILS", locale);
  const decision = d.decisions.find((x) => x.mode === "proposal");
  const offeredTo = d.jobs.find((x) => x.job.status === "OFFERED");
  const latest = d.decisions[0];
  const offeredName = decision?.candidates.find((c) => c.supplierId === latest?.chosenSupplierId)?.supplierName ?? "—";
  const failedJob = d.jobs.find((x) => x.job.status === "QC_FAILED");
  const payment = d.payments.find((p) => ["CAPTURED", "PARTIALLY_REFUNDED"].includes(p.status));
  const quotable = ["REVIEW_REQUIRED", "QUOTE_READY", "DESIGN_REQUIRED", "QUOTE_EXPIRED"].includes(order.status);
  const variants = quotable && can("quote.manual") ? (await catalog.listMaterials(ctx)).flatMap((m) => m.variants.map((v) => ({ value: v.id, label: `${catalogName(m.i18n, locale, m.code)} · ${catalogName(v.i18n, locale, v.colorCode)}` }))) : [];
  const reasonField = { name: "reason", label: t("reason"), kind: "textarea" as const, required: true };

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          <Ltr mono>{order.orderNumber}</Ltr>
        </h1>
        <StatusChip tone={ORDER_TONE[order.status] ?? "neutral"} label={o(`status.${order.status as "PAID"}`)} />
        {order.onHold && <Badge tone="warning">{t("onHoldBadge")}</Badge>}
        <span className="ms-auto text-sm text-text-secondary">
          <Ltr>{d.email}</Ltr> · {o(`flow.${order.flow as "file"}`)}
          {order.promisedShipDate && <> · {t("promisedShip", { date: formatDate(order.promisedShipDate, locale) })}</>}
        </span>
      </div>
      {(order.reviewReasons?.length ?? 0) > 0 && (
        <Banner tone="warning" title={t("reviewReasons")}>
          {order.reviewReasons!.map(reason).join(" · ")}
        </Banner>
      )}
      {order.onHold && order.holdReason && <Banner tone="warning">{reason(order.holdReason)}</Banner>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Panel title={t("items")}>
            <ul className="flex flex-col divide-y divide-border-subtle">
              {d.items.map(({ item, geometry, material, variant }) => (
                <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-text-secondary">
                      ×{formatNumber(item.quantity, locale, 0)} · {material ? catalogName(material.i18n, locale, material.code) : "—"}
                      {variant && ` · ${catalogName(variant.i18n, locale, variant.colorCode)}`}
                    </span>
                    {geometry?.bboxXMm && (
                      <span className="text-text-secondary">
                        {t("geometry")}:{" "}
                        <Ltr mono>
                          {[geometry.bboxXMm, geometry.bboxYMm ?? 0, geometry.bboxZMm ?? 0].map((n) => formatNumber(n * item.scale, locale, 1)).join(" × ")} mm
                        </Ltr>
                        {geometry.isWatertight === false && <Badge tone="warning">{reason("mesh_not_watertight")}</Badge>}
                      </span>
                    )}
                    {Object.keys(item.usage ?? {}).length > 0 && <span className="text-text-secondary">{t("request")}: {Object.values(item.usage).filter((x) => typeof x === "string").join(", ")}</span>}
                  </div>
                  {item.fileId && (
                    <a href={`/api/files/${item.fileId}?purpose=ops_review`} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                      <Download aria-hidden className="size-4" />
                      {t("download")}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t("quote")} aside={d.quote && <Badge tone={d.quote.quote.mode === "manual" ? "signature" : "info"}>{d.quote.quote.mode}</Badge>}>
            {d.quote ? (
              <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <dt className="text-text-secondary">{t("total")}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{money(d.quote.snapshot.totalMinor)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{t("computed")}</dt>
                  <dd className="tabular-nums">{money(d.quote.snapshot.computedTotalMinor)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{t("payout")}</dt>
                  <dd className="tabular-nums">{money(d.quote.snapshot.expectedPayoutMinor)}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">{t("margin")}</dt>
                  <dd className="tabular-nums">
                    {money(d.quote.snapshot.expectedMarginMinor)}
                    {d.quote.snapshot.subtotalNetMinor > 0 && <span className="text-text-secondary"> · {formatPercent(d.quote.snapshot.expectedMarginMinor / d.quote.snapshot.subtotalNetMinor, locale)}</span>}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-text-secondary">—</p>
            )}
            {quotable && can("quote.manual") && (
              <ActionForm
                action={manualQuoteAction.bind(null, locale, orderId)}
                submitLabel={t("publish")}
                dialogTitle={t("manualQuote")}
                fields={[
                  { name: "manufacturingNet", label: t("manufacturingNet"), kind: "money" },
                  { name: "designFee", label: t("designFee"), kind: "money" },
                  { name: "materialVariantId", label: t("material"), kind: "select", options: [{ value: "", label: "—" }, ...variants] },
                  { name: "includeShipping", label: t("includeShipping"), kind: "checkbox", defaultValue: true },
                  reasonField,
                ]}
              />
            )}
          </Panel>

          {(order.status === "ROUTING" || d.decisions.length > 0) && (
            <Panel
              title={t("routing")}
              aside={
                order.status === "ROUTING" && !offeredTo && can("routing.manage") ? <ActionForm action={proposeRoutingAction.bind(null, locale, orderId)} submitLabel={t("propose")} variant="secondary" size="sm" /> : undefined
              }
            >
              {offeredTo && (
                <Banner tone="info">
                  {t("awaitingOffer", { supplier: offeredName })}
                </Banner>
              )}
              {decision ? (
                <DataTable
                  caption={t("candidates")}
                  rows={decision.candidates}
                  rowKey={(c) => c.supplierId}
                  empty={<p className="text-sm text-text-secondary">{reason("routing_no_candidates")}</p>}
                  columns={[
                    { key: "name", header: t("candidates"), cell: (c) => <span className="font-medium">{c.supplierName}</span> },
                    { key: "score", header: t("score"), numeric: true, cell: (c) => (c.score !== undefined ? formatNumber(c.score, locale, 3) : "—") },
                    { key: "why", header: t("reasonCol"), cell: (c) => (c.excludedReason ? t("excluded", { reason: reason(c.excludedReason) }) : Object.entries(c.components ?? {}).map(([k, v]) => `${k} ${formatNumber(v, locale, 2)}`).join(" · ")) },
                    {
                      key: "act",
                      header: "",
                      cell: (c) =>
                        order.status === "ROUTING" && !offeredTo && !c.excludedReason && can("routing.manage") ? (
                          c.supplierId === decision.candidates.find((x) => !x.excludedReason)?.supplierId ? (
                            <ActionForm action={offerAction.bind(null, locale, orderId, c.supplierId, "manual_confirmed")} submitLabel={t("confirm")} size="sm" />
                          ) : (
                            <ActionForm action={offerAction.bind(null, locale, orderId, c.supplierId, "manual_override")} submitLabel={t("override")} variant="secondary" size="sm" dialogTitle={t("override")} fields={[reasonField]} />
                          )
                        ) : null,
                    },
                  ]}
                />
              ) : (
                <p className="text-sm text-text-secondary">—</p>
              )}
            </Panel>
          )}

          {d.jobs.length > 0 && (
            <Panel title={t("jobs")}>
              <ul className="flex flex-col divide-y divide-border-subtle">
                {d.jobs.map(({ job, supplierName }) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusChip tone={JOB_TONE[job.status] ?? "neutral"} label={j(job.status as "ACCEPTED")} size="sm" />
                      <span className="font-medium">{supplierName ?? "—"}</span>
                      <span className="text-text-secondary">
                        #{job.attemptNo} · {job.payoutMinor !== null ? money(job.payoutMinor) : "—"}
                        {job.dueAt && ` · ${formatDateTime(job.dueAt, locale)}`}
                      </span>
                    </span>
                    {job.status === "QC_PENDING" && can("qc.verdict") && (
                      <a href={`/${locale}/ops/qc/${job.id}`} className="text-primary hover:underline">
                        {t("reviewQc")}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {failedJob && can("order.manage") && <ActionForm action={concessionAction.bind(null, locale, orderId, failedJob.job.id)} submitLabel={t("concession")} variant="secondary" dialogTitle={t("concession")} fields={[reasonField]} />}
            </Panel>
          )}

          {(order.status === "READY_FOR_SHIPMENT" || d.shipments.length > 0) && (
            <Panel title={t("shipment")}>
              {d.shipments.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span>
                    <Badge tone="info">{ship.has(s.status) ? ship(s.status) : s.status}</Badge> {s.carrier} · <Ltr mono>{s.trackingNumber ?? "—"}</Ltr>
                  </span>
                  {s.status !== "DELIVERED" && order.status === "SHIPPED" && can("shipment.manage") && (
                    <ActionForm action={markDeliveredAction.bind(null, locale, orderId, s.id)} submitLabel={t("markDelivered")} variant="secondary" size="sm" dialogTitle={t("markDelivered")} />
                  )}
                </div>
              ))}
              {order.status === "READY_FOR_SHIPMENT" && can("shipment.manage") && (
                <div className="flex flex-wrap gap-3">
                  <ActionForm action={shipAction.bind(null, locale, orderId, "provider")} submitLabel={t("shipProvider")} />
                  <ActionForm
                    action={shipAction.bind(null, locale, orderId, "manual")}
                    submitLabel={t("shipManual")}
                    variant="secondary"
                    dialogTitle={t("shipManual")}
                    fields={[
                      { name: "carrier", label: t("carrier"), kind: "text", required: true },
                      { name: "trackingNumber", label: t("tracking"), kind: "text", required: true, ltr: true },
                      { name: "trackingUrl", label: t("trackingUrl"), kind: "text", ltr: true },
                    ]}
                  />
                </div>
              )}
            </Panel>
          )}

          {order.status === "DISPUTED" && can("order.manage") && (
            <Panel title={t("dispute")}>
              <div className="flex flex-wrap gap-3">
                <ActionForm action={resolveDisputeAction.bind(null, locale, orderId, "refund")} submitLabel={t("resolveRefund")} variant="danger-outline" dialogTitle={t("resolveRefund")} fields={[reasonField]} />
                <ActionForm
                  action={resolveDisputeAction.bind(null, locale, orderId, "reprint")}
                  submitLabel={t("resolveReprint")}
                  variant="secondary"
                  dialogTitle={t("resolveReprint")}
                  fields={[{ name: "costBearer", label: t("costBearer"), kind: "select", options: (["supplier", "platform"] as const).map((v) => ({ value: v, label: t(`bearer.${v}`) })) }, reasonField]}
                />
                <ActionForm action={resolveDisputeAction.bind(null, locale, orderId, "close")} submitLabel={t("resolveClose")} variant="ghost" dialogTitle={t("resolveClose")} fields={[reasonField]} />
              </div>
            </Panel>
          )}

          <Panel title={t("history")}>
            <ol className="flex flex-col gap-2 text-sm">
              {d.history.map((h) => (
                <li key={h.id} className="flex flex-wrap gap-x-3">
                  <span className="w-40 shrink-0 text-text-secondary tabular-nums">{formatDateTime(h.at, locale)}</span>
                  <span>
                    {h.fromStatus ? `${o(`status.${h.fromStatus as "PAID"}`)} → ` : ""}
                    <span className="font-medium">{o(`status.${h.toStatus as "PAID"}`)}</span>
                    <span className="text-text-secondary"> · {h.actorType}</span>
                    {h.reason && <span className="text-text-secondary"> · {reason(h.reason)}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          {d.auditTrail.length > 0 && (
            <Panel title={t("audit")}>
              <ol className="flex flex-col gap-1 font-mono text-xs" dir="ltr">
                {d.auditTrail.map((a) => (
                  <li key={a.id}>
                    {formatDateTime(a.at, locale)} · {a.actorType} · {a.action}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          {can("order.manage") && (
            <Panel title={order.onHold ? t("unhold") : t("hold")}>
              <ActionForm action={holdAction.bind(null, locale, orderId, !order.onHold)} submitLabel={order.onHold ? t("unhold") : t("hold")} variant={order.onHold ? "primary" : "secondary"} dialogTitle={order.onHold ? t("unhold") : t("hold")} fields={[reasonField]} />
            </Panel>
          )}

          {d.payments.length > 0 && (
            <Panel title={t("payments")}>
              <ul className="flex flex-col gap-2 text-sm">
                {d.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <Badge tone={p.status === "CAPTURED" ? "success" : "neutral"}>{p.status}</Badge>
                    <span className="tabular-nums">
                      {money(p.amountMinor)}
                      {p.refundedMinor > 0 && <span className="text-danger"> −{money(p.refundedMinor)}</span>}
                    </span>
                  </li>
                ))}
                {d.refunds.map((rf) => (
                  <li key={rf.id} className="flex items-center justify-between gap-2 text-text-secondary">
                    <span>
                      {t("refund")} · {rf.reasonCode} · {rf.status}
                    </span>
                    <span className="tabular-nums">{money(rf.amountMinor)}</span>
                  </li>
                ))}
              </ul>
              {payment && can("refund.request") && (
                <ActionForm
                  action={refundAction.bind(null, locale, orderId)}
                  submitLabel={t("requestRefund")}
                  variant="danger-outline"
                  dialogTitle={t("refund")}
                  dialogDescription={t("refundHint", { max: money(payment.amountMinor - payment.refundedMinor) })}
                  fields={[
                    { name: "amount", label: t("refundAmount"), kind: "money", required: true, defaultValue: ((payment.amountMinor - payment.refundedMinor) / 100).toFixed(2) },
                    { name: "reasonCode", label: t("refundReason"), kind: "select", options: REFUND_REASONS.map((v) => ({ value: v, label: t(`refundReasons.${v}`) })) },
                    { name: "note", label: t("internalNote"), kind: "textarea" },
                  ]}
                />
              )}
            </Panel>
          )}

          <Panel title={t("message")}>
            <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto">
              {d.messages.map((m) => (
                <li key={m.id} className={m.visibility === "internal" ? "rounded-s border border-warning/30 bg-warning-subtle p-3 text-sm" : "rounded-s bg-surface-sunken p-3 text-sm"}>
                  <span className="mb-1 block text-xs text-text-secondary">
                    {m.authorType} · {formatDateTime(m.createdAt, locale)}
                    {m.visibility === "internal" && ` · ${t("internalNote")}`}
                  </span>
                  <span className="whitespace-pre-wrap" dir="auto">
                    {m.body}
                  </span>
                </li>
              ))}
            </ul>
            {can("order.message") && (
              <ActionForm
                action={messageAction.bind(null, locale, orderId)}
                submitLabel={t("sendMessage")}
                variant="secondary"
                fields={[
                  { name: "body", label: t("messageBody"), kind: "textarea", required: true },
                  { name: "internal", label: t("internalNote"), kind: "checkbox" },
                ]}
              />
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
