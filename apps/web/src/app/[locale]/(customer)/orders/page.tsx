import { Package } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { orders } from "@mfg/core";
import { formatDate } from "@mfg/i18n";
import { buttonClasses, EmptyState, Ltr, ORDER_TONE, StatusChip } from "@mfg/ui";
import { resolveLocale } from "@/lib/i18n";
import { ctxFor, requireActor } from "@/lib/session";

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const actor = await requireActor("customer", locale, `/${locale}/orders`);
  const t = await getTranslations("orders");
  const list = await orders.listCustomerOrders(await ctxFor(actor));
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-10 md:px-8">
      <h1 className="text-3xl font-semibold">{t("list.title")}</h1>
      {list.length === 0 ? (
        <EmptyState
          icon={<Package aria-hidden className="size-10" strokeWidth={1.25} />}
          title={t("list.empty")}
          body={t("list.emptyBody")}
          action={
            <Link href={`/${locale}`} className={buttonClasses("primary", "lg")}>
              {t("list.start")}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((o) => (
            <li key={o.id}>
              <Link
                href={`/${locale}/orders/${o.id}`}
                className="flex flex-col gap-3 rounded-m border border-border-subtle bg-surface-raised p-4 shadow-raised transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-focus sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-medium">
                    <Ltr mono>{o.orderNumber}</Ltr>
                  </span>
                  <span className="text-sm text-text-secondary">
                    {t(`flow.${o.flow as "file"}`)} ·{" "}
                    {t("list.placed", { date: formatDate(o.createdAt, locale) })}
                  </span>
                </span>
                <StatusChip
                  tone={ORDER_TONE[o.status] ?? "neutral"}
                  label={t(`status.${o.status as "DRAFT"}`)}
                  description={t(`next.${o.status as "DRAFT"}`)}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
