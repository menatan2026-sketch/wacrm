"use client";
import { CheckCircle2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import type { AppLocale } from "@mfg/i18n/config";
import { formatNumber, parseDecimal } from "@mfg/i18n/format";
import { Banner, Button, Card, Field, Input, Ltr, SectionTitle } from "@mfg/ui";
import { acceptAgreementAction, saveMachineAction, savePayoutDetailsAction, saveProfileAction } from "@/app/actions/partner";
import { useErrorMessage } from "@/lib/errors";

type Profile = { name: string; legalName: string; taxId: string; phone: string; city: string; addressLine: string; leadTimeDays: number };
type Machine = { id: string; name: string; build: number[]; dailyCapacityMinutes: number; materialVariantIds: string[] };
type Variant = { id: string; label: string; colorHex: string };

/** Small helper: one section = its own save button, pending state and result banner. */
function useSection() {
  const errorText = useErrorMessage();
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, start] = useTransition();
  const save = (fn: () => Promise<{ ok: true } | { ok: false; code: string; ref?: string }>) =>
    start(async () => {
      setState({});
      const r = await fn();
      if (!r.ok) return setState({ error: errorText(r) });
      setState({ saved: true });
      router.refresh();
    });
  return { ...state, pending, save, setError: (error: string) => setState({ error }) };
}

function Status({ error, saved }: { error?: string; saved?: boolean }) {
  const c = useTranslations("common.states");
  if (error) return <Banner tone="danger">{error}</Banner>;
  if (saved) return <Banner tone="success">{c("saved")}</Banner>;
  return null;
}

function Section({ title, children, done }: { title: string; children: ReactNode; done?: boolean }) {
  return (
    <Card className="flex flex-col gap-5">
      <SectionTitle className="flex items-center gap-2">
        {title}
        {done && <CheckCircle2 aria-hidden className="size-5 text-success" />}
      </SectionTitle>
      {children}
    </Card>
  );
}

export function ProfileClient({ locale, profile, machines, variants, hasPayout, agreementAccepted }: { locale: string; profile: Profile; machines: Machine[]; variants: Variant[]; hasPayout: boolean; agreementAccepted: boolean }) {
  const t = useTranslations("supplier.profile");
  const v = useTranslations("validation");
  const u = useTranslations("common.units");
  const appLocale = useLocale() as AppLocale;

  const [p, setP] = useState(profile);
  const company = useSection();
  const text = (key: keyof Profile, label: string, opts: { ltr?: boolean; autoComplete?: string } = {}) => (
    <Field label={label}>
      {({ id }) => <Input id={id} dir={opts.ltr ? "ltr" : undefined} autoComplete={opts.autoComplete} value={String(p[key])} onChange={(e) => setP({ ...p, [key]: e.target.value })} />}
    </Field>
  );

  const [m, setM] = useState({ name: "", x: "", y: "", z: "", capacity: "1200", variants: [] as string[] });
  const machine = useSection();

  const [bank, setBank] = useState({ accountName: "", bank: "", branch: "", account: "" });
  const payout = useSection();
  const agreement = useSection();

  return (
    <div className="flex flex-col gap-6">
      <Section title={t("items.company")} done={Boolean(profile.legalName && profile.city)}>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", t("name"))}
          {text("legalName", t("legalName"))}
          {text("taxId", t("taxId"), { ltr: true })}
          {text("phone", t("phone"), { ltr: true, autoComplete: "tel" })}
          {text("city", t("city"), { autoComplete: "address-level2" })}
          {text("addressLine", t("address"), { autoComplete: "street-address" })}
          <Field label={t("leadTime")}>
            {({ id }) => <Input id={id} inputMode="numeric" dir="ltr" value={String(p.leadTimeDays)} onChange={(e) => setP({ ...p, leadTimeDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} />}
          </Field>
        </div>
        <Status error={company.error} saved={company.saved} />
        <Button
          className="w-fit"
          loading={company.pending}
          onClick={() =>
            company.save(() =>
              saveProfileAction(locale, {
                name: p.name,
                legalName: p.legalName || undefined,
                taxId: p.taxId || undefined,
                phone: p.phone || undefined,
                city: p.city || undefined,
                addressLine: p.addressLine || undefined,
                leadTimeDays: p.leadTimeDays || undefined,
              }),
            )
          }
        >
          {t("saveCompany")}
        </Button>
      </Section>

      <Section title={t("machines")} done={machines.length > 0}>
        {machines.length > 0 && (
          <ul className="flex flex-col divide-y divide-border-subtle rounded-m border border-border-subtle">
            {machines.map((mc) => (
              <li key={mc.id} className="flex flex-col gap-1 p-3 text-sm">
                <span className="font-medium">{mc.name}</span>
                <span className="text-text-secondary">
                  <Ltr mono>
                    {mc.build.map((n) => formatNumber(n, appLocale, 0)).join(" × ")} {u("mm")}
                  </Ltr>{" "}
                  · {variants.filter((vr) => mc.materialVariantIds.includes(vr.id)).map((vr) => vr.label).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <fieldset className="flex flex-col gap-4 rounded-m border border-dashed border-border-default p-4">
          <legend className="px-1 text-sm font-medium">{t("addMachine")}</legend>
          <Field label={t("machineName")}>{({ id }) => <Input id={id} value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />}</Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("buildVolume")}</span>
            <div className="grid grid-cols-3 gap-2" dir="ltr">
              {(["x", "y", "z"] as const).map((axis) => (
                <Input key={axis} aria-label={`${t("buildVolume")} ${axis.toUpperCase()}`} inputMode="decimal" placeholder={axis.toUpperCase()} value={m[axis]} onChange={(e) => setM({ ...m, [axis]: e.target.value })} />
              ))}
            </div>
          </div>
          <Field label={t("capacity")}>{({ id }) => <Input id={id} inputMode="numeric" dir="ltr" value={m.capacity} onChange={(e) => setM({ ...m, capacity: e.target.value.replace(/\D/g, "") })} />}</Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("materials")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {variants.map((vr) => (
                <label key={vr.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-s border border-border-subtle px-3 text-sm hover:bg-surface-base">
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    checked={m.variants.includes(vr.id)}
                    onChange={(e) => setM({ ...m, variants: e.target.checked ? [...m.variants, vr.id] : m.variants.filter((x) => x !== vr.id) })}
                  />
                  <span aria-hidden className="size-3 rounded-full border border-border-default" style={{ backgroundColor: vr.colorHex }} />
                  {vr.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Status error={machine.error} saved={machine.saved} />
          <Button
            variant="secondary"
            className="w-fit"
            icon={<Plus aria-hidden className="size-4" />}
            loading={machine.pending}
            onClick={() => {
              const dims = [m.x, m.y, m.z].map(parseDecimal);
              if (!m.name.trim() || dims.some((d) => d === null || d <= 0) || !m.variants.length) return machine.setError(v("summary"));
              machine.save(async () => {
                const r = await saveMachineAction(locale, { name: m.name, buildXMm: dims[0], buildYMm: dims[1], buildZMm: dims[2], dailyCapacityMinutes: Number(m.capacity), materialVariantIds: m.variants });
                if (r.ok) setM({ name: "", x: "", y: "", z: "", capacity: "1200", variants: [] });
                return r.ok ? { ok: true } : r;
              });
            }}
          >
            {t("saveMachine")}
          </Button>
        </fieldset>
      </Section>

      <Section title={t("payoutTitle")} done={hasPayout}>
        <p className="text-sm text-text-secondary">{t("payoutHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("accountName")}>{({ id }) => <Input id={id} value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} />}</Field>
          <Field label={t("bank")}>{({ id }) => <Input id={id} inputMode="numeric" dir="ltr" value={bank.bank} onChange={(e) => setBank({ ...bank, bank: e.target.value })} />}</Field>
          <Field label={t("branch")}>{({ id }) => <Input id={id} inputMode="numeric" dir="ltr" value={bank.branch} onChange={(e) => setBank({ ...bank, branch: e.target.value })} />}</Field>
          <Field label={t("account")}>{({ id }) => <Input id={id} inputMode="numeric" dir="ltr" autoComplete="off" value={bank.account} onChange={(e) => setBank({ ...bank, account: e.target.value })} />}</Field>
        </div>
        <Status error={payout.error} saved={payout.saved} />
        <Button
          className="w-fit"
          loading={payout.pending}
          onClick={() => {
            if (Object.values(bank).some((x) => !x.trim())) return payout.setError(v("summary"));
            payout.save(async () => {
              const r = await savePayoutDetailsAction(locale, bank);
              if (r.ok) setBank({ accountName: "", bank: "", branch: "", account: "" });
              return r;
            });
          }}
        >
          {t("savePayout")}
        </Button>
      </Section>

      <Section title={t("items.agreement")} done={agreementAccepted}>
        <p className="text-sm">{t("agreementText")}</p>
        <Status error={agreement.error} />
        {agreementAccepted ? (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 aria-hidden className="size-4" />
            {t("accepted")}
          </p>
        ) : (
          <Button className="w-fit" loading={agreement.pending} onClick={() => agreement.save(() => acceptAgreementAction(locale))}>
            {t("accept")}
          </Button>
        )}
      </Section>
    </div>
  );
}
