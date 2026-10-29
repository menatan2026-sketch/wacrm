"use client";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Banner, Button, Card, Dialog, Field, Input, RadioCards, Textarea } from "@mfg/ui";
import { cancelOrderAction, checkoutAction, reorderAction, reportProblemAction, requoteAction, sendMessageAction } from "@/app/actions/orders";
import { useErrorMessage } from "@/lib/errors";
import { useRouter } from "next/navigation";

export function QuotePanel({ orderId, locale, quantity, urgency, total, lines, vat, validUntil, canChange }: { orderId: string; locale: string; quantity: number; urgency: "standard" | "fast" | "urgent"; total: string; lines: { label: string; amount: string }[]; vat: { label: string; amount: string }; validUntil: string; canChange: boolean }) {
  const tq = useTranslations("quotes");
  const tp = useTranslations("payments.checkout");
  const tm = useTranslations("manufacturing");
  const tw = useTranslations("customer.wizard.price");
  const errorText = useErrorMessage();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(quantity));
  const [urg, setUrg] = useState(urgency);
  const idem = useRef(`co-${orderId}-${Math.random().toString(36).slice(2)}`);
  const [address, setAddress] = useState({ recipientName: "", phone: "", line1: "", line2: "", city: "", postalCode: "", notes: "" });
  const set = (k: keyof typeof address) => (e: React.ChangeEvent<HTMLInputElement>) => setAddress((a) => ({ ...a, [k]: e.target.value }));

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold">{tq("title")}</h2>
        <span className="text-sm text-text-secondary">{validUntil}</span>
      </div>
      <dl className="flex flex-col gap-2 text-sm">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-4">
            <dt className="text-text-secondary">{l.label}</dt>
            <dd className="tabular-nums">{l.amount}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-border-subtle pt-2">
          <dt className="text-text-secondary">{vat.label}</dt>
          <dd className="tabular-nums">{vat.amount}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 pt-1">
          <dt className="font-medium">{tq("total")}</dt>
          <dd className="text-3xl font-medium tabular-nums">{total}</dd>
        </div>
      </dl>
      <p className="text-xs text-text-secondary">{tq("includes")}</p>
      {canChange && !editing && (
        <button type="button" className="self-start text-sm text-primary hover:underline" onClick={() => setEditing(true)}>
          {tq("change")}
        </button>
      )}
      {editing && (
        <div className="flex flex-col gap-4 rounded-m border border-border-subtle p-4">
          <Field label={tw("quantity")} className="w-32">
            {({ id }) => <Input id={id} type="number" min={1} max={500} dir="ltr" value={qty} onChange={(e) => setQty(e.target.value)} />}
          </Field>
          <RadioCards name="urgency" legend={tw("urgency")} columns={3} value={urg} onChange={setUrg} options={(["standard", "fast", "urgent"] as const).map((u) => ({ value: u, title: tm(`urgency.${u}`) }))} />
          <Button
            variant="secondary"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await requoteAction(orderId, locale, { quantity: Number(qty), urgency: urg });
                if (!r.ok) return setError(errorText(r));
                setEditing(false);
                router.refresh();
              })
            }
          >
            {tq("update")}
          </Button>
        </div>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(undefined);
            const r = await checkoutAction(orderId, locale, { ...address, line2: address.line2 || undefined, postalCode: address.postalCode || undefined, notes: address.notes || undefined }, idem.current);
            if (r && !r.ok) setError(errorText(r));
          });
        }}
      >
        <h3 className="font-semibold">{tp("address")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tp("name")}>{({ id }) => <Input id={id} autoComplete="name" required value={address.recipientName} onChange={set("recipientName")} />}</Field>
          <Field label={tp("phone")} hint={tp("phoneHint")}>{({ id, describedBy }) => <Input id={id} type="tel" dir="ltr" autoComplete="tel" required value={address.phone} aria-describedby={describedBy} onChange={set("phone")} />}</Field>
          <Field label={tp("line1")} className="sm:col-span-2">{({ id }) => <Input id={id} autoComplete="address-line1" required value={address.line1} onChange={set("line1")} />}</Field>
          <Field label={tp("line2")}>{({ id }) => <Input id={id} autoComplete="address-line2" value={address.line2} onChange={set("line2")} />}</Field>
          <Field label={tp("city")}>{({ id }) => <Input id={id} autoComplete="address-level2" required value={address.city} onChange={set("city")} />}</Field>
          <Field label={tp("postalCode")}>{({ id }) => <Input id={id} dir="ltr" autoComplete="postal-code" value={address.postalCode} onChange={set("postalCode")} />}</Field>
          <Field label={tp("notes")}>{({ id }) => <Input id={id} value={address.notes} onChange={set("notes")} />}</Field>
        </div>
        {error && <Banner tone="danger">{error}</Banner>}
        <Button type="submit" size="xl" loading={pending}>
          {tq("pay", { total })}
        </Button>
        <p className="text-xs text-text-secondary">{tp("secure")}</p>
      </form>
    </Card>
  );
}

export function MessagesPanel({ orderId, locale, messages }: { orderId: string; locale: string; messages: { id: string; mine: boolean; body: string; at: string }[] }) {
  const t = useTranslations("orders.detail");
  const errorText = useErrorMessage();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-semibold">{t("messages")}</h2>
      {messages.length === 0 ? (
        <p className="text-sm text-text-secondary">{t("noMessages")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className={`flex max-w-[85%] flex-col gap-1 rounded-m p-3 text-sm ${m.mine ? "self-end bg-primary-subtle" : "self-start bg-surface-sunken"}`}>
              <span className="text-xs font-medium text-text-secondary">
                {m.mine ? t("fromYou") : t("fromTeam")} · {m.at}
              </span>
              <span className="whitespace-pre-wrap">{m.body}</span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await sendMessageAction(orderId, locale, body);
            if (!r.ok) return setError(errorText(r));
            setBody("");
            router.refresh();
          });
        }}
      >
        <Field label={t("reply")} error={error}>
          {({ id, invalid }) => <Textarea id={id} rows={3} value={body} invalid={invalid} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <Button type="submit" variant="secondary" className="self-end" loading={pending} disabled={!body.trim()}>
          {t("send")}
        </Button>
      </form>
    </Card>
  );
}

export function OrderActions({ orderId, locale, cancellable, paid, canReport, canReorder }: { orderId: string; locale: string; cancellable: boolean; paid: boolean; canReport: boolean; canReorder: boolean }) {
  const t = useTranslations("orders.detail");
  const tc = useTranslations("common.actions");
  const errorText = useErrorMessage();
  const router = useRouter();
  const [dialog, setDialog] = useState<"cancel" | "problem" | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!cancellable && !canReport && !canReorder) return null;
  return (
    <div className="flex flex-col gap-2">
      {canReorder && (
        <Button size="lg" loading={pending} onClick={() => start(() => reorderAction(orderId, locale))}>
          {t("reorder")}
        </Button>
      )}
      {canReport && (
        <Button variant="secondary" onClick={() => setDialog("problem")}>
          {t("problem")}
        </Button>
      )}
      {cancellable && (
        <Button variant="danger-outline" onClick={() => setDialog("cancel")}>
          {t("cancel")}
        </Button>
      )}
      <Dialog
        open={dialog === "cancel"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("cancelTitle")}
        description={paid ? t("cancelBodyPaid") : t("cancelBodyUnpaid")}
        closeLabel={tc("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {t("keep")}
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await cancelOrderAction(orderId, locale, text);
                  if (!r.ok) return setError(errorText(r));
                  setDialog(null);
                  router.refresh();
                })
              }
            >
              {t("confirmCancel")}
            </Button>
          </>
        }
      >
        <Field label={t("cancelReason")} error={error}>
          {({ id }) => <Input id={id} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
      </Dialog>
      <Dialog
        open={dialog === "problem"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={t("problemTitle")}
        description={t("problemBody")}
        closeLabel={tc("close")}
        footer={
          <Button
            loading={pending}
            disabled={text.trim().length < 10}
            onClick={() =>
              start(async () => {
                const r = await reportProblemAction(orderId, locale, text);
                if (!r.ok) return setError(errorText(r));
                setDialog(null);
                router.refresh();
              })
            }
          >
            {t("problemSend")}
          </Button>
        }
      >
        <Field label={t("problemTitle")} error={error}>
          {({ id }) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
      </Dialog>
    </div>
  );
}
