"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Banner, Button, Dialog, Field, Input, Select, Textarea, type ButtonProps } from "@mfg/ui";
import { useErrorMessage } from "@/lib/errors";

export type FormField =
  | {
      name: string;
      label: string;
      kind: "text" | "money" | "textarea";
      required?: boolean;
      hint?: string;
      ltr?: boolean;
      defaultValue?: string;
    }
  | {
      name: string;
      label: string;
      kind: "select";
      options: { value: string; label: string }[];
      required?: boolean;
      defaultValue?: string;
    }
  | { name: string; label: string; kind: "checkbox"; defaultValue?: boolean };

type Result =
  | { ok: true; data?: unknown }
  | { ok: false; code: string; ref?: string; details?: Record<string, unknown> };

/**
 * Generic staff form: renders typed fields, calls a bound server action with string values, shows
 * translated errors and refreshes the page on success. With `confirm`, it opens in a dialog so the
 * action is never one accidental click away.
 */
export function ActionForm({
  action,
  fields = [],
  submitLabel,
  variant = "primary",
  size = "md",
  dialogTitle,
  dialogDescription,
  successMessage,
  resultField,
}: {
  action: (values: Record<string, string>) => Promise<Result>;
  fields?: FormField[];
  submitLabel: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  /** When set, the button opens a dialog containing the fields. */
  dialogTitle?: string;
  dialogDescription?: string;
  successMessage?: string;
  /** Show this field of the action's returned data (e.g. an invite link) under the success message. */
  resultField?: string;
}) {
  const c = useTranslations("common");
  const v = useTranslations("validation");
  const errorText = useErrorMessage();
  const router = useRouter();
  const initial = () =>
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.kind === "checkbox"
          ? f.defaultValue
            ? "on"
            : ""
          : (f.defaultValue ?? (f.kind === "select" ? (f.options[0]?.value ?? "") : "")),
      ]),
    );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [missing, setMissing] = useState<string[]>([]);
  const [result, setResult] = useState<{ data: unknown } | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(undefined);
      setResult(null);
      const empty = fields
        .filter((f) => f.kind !== "checkbox" && f.required && !values[f.name]?.trim())
        .map((f) => f.name);
      setMissing(empty);
      if (empty.length) return setError(v("summary"));
      const r = await action(values);
      if (!r.ok) return setError(errorText(r));
      setResult({ data: r.data });
      setOpen(false);
      setValues(initial());
      router.refresh();
    });

  const body = (
    <div className="flex flex-col gap-4">
      {fields.map((f) =>
        f.kind === "checkbox" ? (
          <label key={f.name} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={values[f.name] === "on"}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.checked ? "on" : "" })}
            />
            {f.label}
          </label>
        ) : (
          <Field
            key={f.name}
            label={f.label}
            hint={"hint" in f ? f.hint : undefined}
            error={missing.includes(f.name) ? v("required") : undefined}
          >
            {({ id, describedBy, invalid }) =>
              f.kind === "select" ? (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  value={values[f.name]}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : f.kind === "textarea" ? (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  rows={f.name === "rules" ? 18 : 3}
                  dir={f.ltr ? "ltr" : undefined}
                  className={f.ltr ? "font-mono text-xs" : undefined}
                  value={values[f.name]}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                />
              ) : (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  dir={f.kind === "money" || f.ltr ? "ltr" : undefined}
                  inputMode={f.kind === "money" ? "decimal" : undefined}
                  value={values[f.name]}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                />
              )
            }
          </Field>
        ),
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </div>
  );

  const extra =
    resultField && result?.data && typeof result.data === "object"
      ? String((result.data as Record<string, unknown>)[resultField] ?? "")
      : "";
  const outcome =
    result && (successMessage || extra) ? (
      <Banner tone="success" title={successMessage}>
        {extra && (
          <code dir="ltr" className="break-all font-mono text-xs">
            {extra}
          </code>
        )}
      </Banner>
    ) : null;

  if (dialogTitle) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant={variant} size={size} onClick={() => setOpen(true)}>
          {submitLabel}
        </Button>
        {outcome}
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title={dialogTitle}
          description={dialogDescription}
          closeLabel={c("actions.cancel")}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {c("actions.cancel")}
              </Button>
              <Button
                variant={variant === "danger-outline" ? "danger" : variant}
                loading={pending}
                onClick={submit}
              >
                {submitLabel}
              </Button>
            </div>
          }
        >
          {body}
        </Dialog>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {fields.length > 0 && body}
      {fields.length === 0 && error && <Banner tone="danger">{error}</Banner>}
      <Button type="submit" variant={variant} size={size} loading={pending} className="w-fit">
        {submitLabel}
      </Button>
      {outcome}
    </form>
  );
}
