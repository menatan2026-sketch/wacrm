/**
 * Lead pipeline: validate → normalise → fan out to every configured sink.
 *
 * Sinks are independent; one failing never blocks the others, and the
 * visitor gets a success response as long as at least one sink accepted
 * the lead (or none are configured, in development).
 */
import type { LeadInput, LeadSource } from "@/domain/types";

const SOURCES: LeadSource[] = ["find-my-car", "vehicle-request", "sourcing-request", "calculator", "specialist"];

export type LeadValidation = { ok: true; lead: LeadInput } | { ok: false; errors: Record<string, string> };

const clean = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/** Loose E.164 normalisation, defaulting to Israel for local numbers. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  let e164: string;
  if (digits.startsWith("+")) e164 = digits;
  else if (digits.startsWith("00")) e164 = `+${digits.slice(2)}`;
  else if (digits.startsWith("0")) e164 = `+972${digits.slice(1)}`;
  else if (digits.startsWith("972")) e164 = `+${digits}`;
  else e164 = `+${digits}`;
  return /^\+\d{8,15}$/.test(e164) ? e164 : null;
}

export function validateLead(body: unknown): LeadValidation {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const source = SOURCES.includes(b.source as LeadSource) ? (b.source as LeadSource) : undefined;
  if (!source) errors.source = "Unknown form.";

  const name = clean(b.name, 120);
  if (!name || name.length < 2) errors.name = "Please tell us your name.";

  const phoneRaw = clean(b.phone, 40) ?? "";
  const phone = normalisePhone(phoneRaw);
  if (!phone) errors.phone = "Please enter a phone number we can reach you on.";

  const email = clean(b.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "That email doesn't look right.";

  if (b.consent !== true) errors.consent = "We need your consent to contact you.";

  if (Object.keys(errors).length) return { ok: false, errors };

  const criteria = typeof b.criteria === "object" && b.criteria ? (b.criteria as LeadInput["criteria"]) : undefined;
  const pref = b.preferredContact;

  return {
    ok: true,
    lead: {
      source: source!,
      name: name!,
      phone: phone!,
      email: email || undefined,
      preferredContact: pref === "phone" || pref === "email" || pref === "whatsapp" ? pref : "whatsapp",
      vehicleSlug: clean(b.vehicleSlug, 120),
      criteria,
      mustHave: clean(b.mustHave),
      niceToHave: clean(b.niceToHave),
      message: clean(b.message, 4000),
      consent: true,
      company: clean(b.company, 200),
    },
  };
}

export interface LeadSink {
  name: string;
  enabled(): boolean;
  send(lead: LeadInput & { id: string; receivedAt: string }): Promise<void>;
}

/** Summary line used by sinks that only take free text. */
export function leadSummary(lead: LeadInput): string {
  const c = lead.criteria ?? {};
  const want = [c.yearMin, c.make, c.model, c.color].filter(Boolean).join(" ");
  return [
    `[${lead.source}]`,
    lead.vehicleSlug ? `vehicle=${lead.vehicleSlug}` : want || "open brief",
    c.budgetMaxILS ? `budget≤₪${c.budgetMaxILS.toLocaleString("en-US")}` : "",
    c.mileageMaxKm ? `km≤${c.mileageMaxKm.toLocaleString("en-US")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** wacrm (this repo's CRM): find-or-create the contact by phone, tagged. */
const wacrmSink: LeadSink = {
  name: "wacrm",
  enabled: () => Boolean(process.env.WACRM_API_URL && process.env.WACRM_API_KEY),
  async send(lead) {
    const tags = ["web-lead", `lead:${lead.source}`];
    if (lead.criteria?.make) tags.push(`make:${lead.criteria.make}`.toLowerCase());
    if (lead.vehicleSlug) tags.push(`vehicle:${lead.vehicleSlug}`);
    const res = await fetch(`${process.env.WACRM_API_URL!.replace(/\/$/, "")}/api/v1/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WACRM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone: lead.phone, name: lead.name, email: lead.email, tags }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`wacrm responded ${res.status}`);
  },
};

/** Generic JSON webhook — Zapier/Make/n8n or a custom lead service. */
const webhookSink: LeadSink = {
  name: "webhook",
  enabled: () => Boolean(process.env.LEAD_WEBHOOK_URL),
  async send(lead) {
    const res = await fetch(process.env.LEAD_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, summary: leadSummary(lead) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`webhook responded ${res.status}`);
  },
};

const consoleSink: LeadSink = {
  name: "console",
  // Always on in development; in production only as a last resort, so a
  // misconfigured deploy never silently drops a lead.
  enabled: () => process.env.NODE_ENV !== "production" || (!wacrmSink.enabled() && !webhookSink.enabled()),
  async send(lead) {
    console.info("[lead]", leadSummary(lead), { id: lead.id, name: lead.name, phone: lead.phone });
  },
};

export const leadSinks: LeadSink[] = [wacrmSink, webhookSink, consoleSink];

export async function deliverLead(lead: LeadInput) {
  const record = { ...lead, id: crypto.randomUUID(), receivedAt: new Date().toISOString() };
  const active = leadSinks.filter((s) => s.enabled());
  const results = await Promise.allSettled(active.map((s) => s.send(record)));
  const failures = results
    .map((r, i) => (r.status === "rejected" ? `${active[i].name}: ${String(r.reason)}` : null))
    .filter(Boolean);
  if (failures.length) console.error("[lead] sink failures", failures);
  const delivered = active.length === 0 || failures.length < active.length;
  return { id: record.id, delivered };
}
