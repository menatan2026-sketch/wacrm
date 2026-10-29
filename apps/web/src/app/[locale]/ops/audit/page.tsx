import { getTranslations } from "next-intl/server";
import { audit } from "@mfg/core";
import { formatDateTime } from "@mfg/i18n";
import { Button, DataTable, EmptyState, Input, Ltr } from "@mfg/ui";
import { resolveLocale } from "@/lib/i18n";
import { opsContext } from "@/lib/ops";

export default async function OpsAudit({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const locale = await resolveLocale(params);
  const { type, id } = await searchParams;
  const { ctx } = await opsContext(locale, `/${locale}/ops/audit`);
  const t = await getTranslations("admin.audit");
  const c = await getTranslations("common.actions");
  const rows = await audit.queryAudit(ctx, {
    resourceType: type?.trim().slice(0, 60) || undefined,
    resourceId: id?.trim().slice(0, 80) || undefined,
    limit: 200,
  });
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <form
        role="search"
        action={`/${locale}/ops/audit`}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t("resource")}
          <Input name="type" defaultValue={type ?? ""} dir="ltr" />
        </label>
        <label className="flex min-w-72 flex-col gap-1.5 text-sm font-medium">
          {t("resourceId")}
          <Input name="id" defaultValue={id ?? ""} dir="ltr" />
        </label>
        <Button type="submit" variant="secondary">
          {c("search")}
        </Button>
      </form>
      <DataTable
        caption={t("title")}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState title={t("empty")} />}
        columns={[
          { key: "when", header: t("when"), cell: (r) => formatDateTime(r.at, locale) },
          {
            key: "who",
            header: t("who"),
            cell: (r) =>
              r.actorType === "system" ? (
                t("system")
              ) : (
                <Ltr mono>{r.actorId?.slice(0, 8) ?? r.actorType}</Ltr>
              ),
          },
          { key: "action", header: t("action"), cell: (r) => <Ltr mono>{r.action}</Ltr> },
          {
            key: "resource",
            header: t("resource"),
            cell: (r) => <Ltr mono>{`${r.resourceType}:${r.resourceId?.slice(0, 12) ?? ""}`}</Ltr>,
          },
          {
            key: "reason",
            header: t("reason"),
            cell: (r) => <span dir="auto">{r.reason ?? "—"}</span>,
          },
        ]}
      />
    </div>
  );
}
