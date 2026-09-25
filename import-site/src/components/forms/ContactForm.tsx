"use client";

import { useId, useState } from "react";
import type { LeadSource } from "@/domain/types";
import { parseQuery } from "@/lib/search/parse-query";
import { whatsappHref } from "@/config/site";
import { ArrowRight } from "@/components/ui/icons";
import f from "@/components/ui/fields.module.css";
import { Confirmation } from "./Confirmation";
import s from "./ContactForm.module.css";

export interface ContactPrefill {
  make?: string;
  model?: string;
  year?: string;
  budget?: string;
  mileage?: string;
  color?: string;
  message?: string;
}

type Status = "idle" | "sending" | "done" | "error";

/**
 * "Can't find the right car?" — the sourcing brief. Posts to /api/leads,
 * which fans out to the CRM; the free-text spec is parsed into structured
 * criteria on the way so the brief arrives already organised.
 */
export function ContactForm({
  source = "sourcing-request",
  vehicleSlug,
  vehicleLabel,
  prefill = {},
  mode = "full",
}: {
  source?: LeadSource;
  vehicleSlug?: string;
  vehicleLabel?: string;
  prefill?: ContactPrefill;
  mode?: "full" | "vehicle";
}) {
  const uid = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ref, setRef] = useState("");
  const [pref, setPref] = useState<"whatsapp" | "phone" | "email">("whatsapp");
  const [summary, setSummary] = useState("");

  const id = (n: string) => `${uid}-${n}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();

    const brief = [get("year"), get("make"), get("model"), get("color"), get("budget") && `under ${get("budget")}`, get("mileage") && `under ${get("mileage")} km`, get("message")]
      .filter(Boolean)
      .join(", ");
    const { criteria } = parseQuery(brief);

    const payload = {
      source,
      vehicleSlug,
      name: get("name"),
      phone: get("phone"),
      email: get("email") || undefined,
      preferredContact: pref,
      criteria: {
        ...criteria,
        make: get("make") || criteria.make,
        model: get("model") || criteria.model,
        color: get("color") || criteria.color,
      },
      mustHave: get("mustHave"),
      niceToHave: get("niceToHave"),
      message: get("message"),
      consent: fd.get("consent") === "on",
      company: get("company"),
    };

    setStatus("sending");
    setErrors({});
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data.errors) {
        setErrors(data.errors);
        setStatus("idle");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "failed");
      setRef(`P-${String(data.id ?? "").replace(/-/g, "").slice(0, 6).toUpperCase() || "000000"}`);
      setSummary(
        vehicleLabel ??
          ([get("year"), get("make"), get("model")].filter(Boolean).join(" ") || "Your brief"),
      );
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return <Confirmation reference={ref} summary={summary} channel={pref} />;
  }

  const err = (k: string) =>
    errors[k] ? (
      <span className={f.error} id={id(`${k}-err`)}>
        {errors[k]}
      </span>
    ) : null;

  return (
    <form className={s.form} onSubmit={onSubmit} noValidate>
      {mode === "full" && (
        <fieldset className={s.group}>
          <legend className={s.legend}>
            <span>01</span> What are you looking for?
          </legend>
          <div className={s.grid3}>
            <Field label="Brand" name="make" id={id("make")} placeholder="Porsche" defaultValue={prefill.make} autoComplete="off" />
            <Field label="Model" name="model" id={id("model")} placeholder="911 GT3 RS" defaultValue={prefill.model} autoComplete="off" />
            <Field label="Year" name="year" id={id("year")} placeholder="2023 or newer" defaultValue={prefill.year} autoComplete="off" />
            <Field label="Budget" hint="₪, landed" name="budget" id={id("budget")} placeholder="₪1,400,000" defaultValue={prefill.budget} autoComplete="off" />
            <Field label="Mileage" hint="max km" name="mileage" id={id("mileage")} placeholder="20,000" defaultValue={prefill.mileage} autoComplete="off" />
            <Field label="Colour" name="color" id={id("color")} placeholder="Arctic Grey" defaultValue={prefill.color} autoComplete="off" />
          </div>
          <div className={s.grid2}>
            <Field label="Must-have options" name="mustHave" id={id("mustHave")} placeholder="Weissach, front-axle lift" autoComplete="off" />
            <Field label="Nice-to-have options" name="niceToHave" id={id("niceToHave")} placeholder="Carbon buckets, PCCB" autoComplete="off" />
          </div>
          <div className={f.field}>
            <label className={f.label} htmlFor={id("message")}>
              Your specification
            </label>
            <textarea
              id={id("message")}
              name="message"
              className={f.control}
              rows={4}
              placeholder="Describe your dream specification..."
              defaultValue={prefill.message}
            />
          </div>
        </fieldset>
      )}

      <fieldset className={s.group}>
        <legend className={s.legend}>
          <span>{mode === "full" ? "02" : "01"}</span> How do we reach you?
        </legend>
        <div className={s.grid3}>
          <Field label="Name" name="name" id={id("name")} autoComplete="name" required error={err("name")} invalid={!!errors.name} />
          <Field label="Phone" name="phone" id={id("phone")} type="tel" autoComplete="tel" placeholder="050-000-0000" required error={err("phone")} invalid={!!errors.phone} />
          <Field label="Email" hint="optional" name="email" id={id("email")} type="email" autoComplete="email" error={err("email")} invalid={!!errors.email} />
        </div>
        <div className={f.field}>
          <span className={f.label}>Preferred contact</span>
          <div className={f.segmented} role="group" aria-label="Preferred contact">
            {(["whatsapp", "phone", "email"] as const).map((p) => (
              <button key={p} type="button" aria-pressed={pref === p} onClick={() => setPref(p)}>
                {p === "whatsapp" ? "WhatsApp" : p === "phone" ? "Phone call" : "Email"}
              </button>
            ))}
          </div>
        </div>
        <input type="text" name="company" tabIndex={-1} autoComplete="off" className={s.hp} aria-hidden="true" />
        <label className={f.check}>
          <input type="checkbox" name="consent" aria-invalid={!!errors.consent} />
          <span>
            I agree to be contacted about this request and to the processing of my details as described in the{" "}
            <a href="/privacy" className={s.inlineLink}>
              privacy policy
            </a>
            .
          </span>
        </label>
        {err("consent")}
      </fieldset>

      <div className={s.submitRow}>
        <button type="submit" className="btn btn-primary" disabled={status === "sending"} data-cursor="open">
          {status === "sending" ? "Sending…" : mode === "vehicle" ? "Request this vehicle" : "Start the search"}
          <ArrowRight className="btn-arrow" />
        </button>
        {status === "error" && (
          <p className={s.errorMsg} role="alert">
            We couldn&apos;t send that just now.{" "}
            <a href={whatsappHref("Hi Portolan — I tried to send a sourcing request from the website.")} target="_blank" rel="noreferrer">
              Message us on WhatsApp
            </a>{" "}
            instead.
          </p>
        )}
        <p className={s.note}>A specialist replies within one business day. No obligation, no deposit to talk.</p>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  id,
  error,
  invalid,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; id: string; error?: React.ReactNode; invalid?: boolean }) {
  return (
    <div className={f.field}>
      <label className={f.label} htmlFor={id}>
        {label} {hint && <span className={f.hint}>{hint}</span>}
      </label>
      <input id={id} className={f.control} aria-invalid={invalid || undefined} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {error}
    </div>
  );
}
