import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { notifications } from "@mfg/core";
import { formatDate } from "@mfg/i18n";
import { Card, Ltr } from "@mfg/ui";
import { resolveLocale } from "@/lib/i18n";
import { ctxFor, requireActor } from "@/lib/session";
import { AccountPreferences, SignOutButton } from "./AccountClient";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const actor = await requireActor("customer", locale, `/${locale}/account`);
  const t = await getTranslations("customer.account");
  const tn = await getTranslations("notifications");
  const list = await notifications.myNotifications(await ctxFor(actor));
  const motion = (await cookies()).get("mfg_motion")?.value ?? "system";
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-10 md:px-8">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <Card className="flex flex-col gap-1">
        <span className="text-sm text-text-secondary">{t("email")}</span>
        <Ltr>{actor.email}</Ltr>
      </Card>
      <AccountPreferences motion={motion as "system"} />
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("notifications")}</h2>
        {list.length === 0 ? (
          <p className="text-sm text-text-secondary">{t("noNotifications")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {list.map((n) => (
              <li key={n.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span className="font-medium">
                  {tn.has(`${n.kind}.subject`)
                    ? tn(
                        `${n.kind}.subject`,
                        Object.fromEntries(
                          Object.entries(n.payload).map(([k, v]) => [k, String(v ?? "")]),
                        ),
                      )
                    : n.kind}
                </span>
                <span className="text-text-secondary">{formatDate(n.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("privacy")}</h2>
        <p className="text-sm text-text-secondary">{t("privacyBody")}</p>
      </Card>
      <SignOutButton locale={locale} />
    </div>
  );
}
