import { FileBox, Lightbulb, ShieldCheck, Wrench, BadgeCheck, Receipt } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { drafts } from "@mfg/core";
import { buttonClasses } from "@mfg/ui";
import { resolveLocale } from "@/lib/i18n";
import { ctxFor, guestOrUser } from "@/lib/session";
import { StartFlowButton } from "./StartFlowButton";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("customer.home");
  const actor = await guestOrUser();
  const open =
    actor.kind === "user" || (actor.kind === "guest" && actor.anonKey)
      ? await drafts.latestOpenDrafts(await ctxFor(actor)).catch(() => [])
      : [];
  const flows = [
    { flow: "file", Icon: FileBox },
    { flow: "object", Icon: Wrench },
    { flow: "idea", Icon: Lightbulb },
  ] as const;
  return (
    <>
      <section className="relative overflow-hidden border-b border-border-subtle">
        <div aria-hidden className="tech-grid absolute inset-0 opacity-60" />
        <div className="relative mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-14 md:px-8 md:py-20">
          <p className="text-sm font-semibold text-signature">{t("eyebrow")}</p>
          <h1 className="max-w-3xl text-[clamp(2rem,5vw,3.5rem)] leading-[1.08] font-semibold text-balance">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-text-secondary">{t("subtitle")}</p>
          {open[0] && (
            <Link
              href={`/${locale}/new/${open[0].id}`}
              className={buttonClasses("secondary", "md", "self-start")}
            >
              {t("continueDraft")}
            </Link>
          )}
        </div>
      </section>
      <section aria-labelledby="choose" className="mx-auto max-w-[1200px] px-4 py-12 md:px-8">
        <h2 id="choose" className="mb-6 text-2xl font-semibold">
          {t("choose")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {flows.map(({ flow, Icon }) => (
            <li
              key={flow}
              className="flex flex-col gap-4 rounded-l border border-border-subtle bg-surface-raised p-6 shadow-raised"
            >
              <span className="flex size-12 items-center justify-center rounded-m bg-primary-subtle text-primary">
                <Icon aria-hidden className="size-6" strokeWidth={1.5} />
              </span>
              <h3 className="text-lg font-semibold">{t(`${flow}.title`)}</h3>
              <p className="flex-1 text-text-secondary">{t(`${flow}.body`)}</p>
              <StartFlowButton
                flow={flow}
                locale={locale}
                label={t(`${flow}.cta`)}
                primary={flow === "file"}
              />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="how" className="border-t border-border-subtle bg-surface-raised">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 md:grid-cols-2 md:px-8">
          <div>
            <h2 id="how" className="mb-6 text-2xl font-semibold">
              {t("how")}
            </h2>
            <ol className="flex flex-col gap-4">
              {(["s1", "s2", "s3", "s4"] as const).map((s, i) => (
                <li key={s} className="flex items-center gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border-strong font-mono text-sm">
                    {i + 1}
                  </span>
                  <span>{t(`steps.${s}`)}</span>
                </li>
              ))}
            </ol>
          </div>
          <ul className="flex flex-col justify-center gap-4">
            {[
              { k: "qc", Icon: BadgeCheck },
              { k: "private", Icon: ShieldCheck },
              { k: "price", Icon: Receipt },
            ].map(({ k, Icon }) => (
              <li
                key={k}
                className="flex items-center gap-3 rounded-m border border-border-subtle p-4"
              >
                <Icon aria-hidden className="size-5 text-success" />
                <span className="font-medium">{t(`trust.${k}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
