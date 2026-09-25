import { NextResponse } from "next/server";
import { deliverLead, validateLead } from "@/lib/leads";

// Simple in-memory rate limit per IP. Replace with a shared store
// (Upstash/Redis, Supabase) when running more than one instance.
const hits = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;

function limited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests — please try again shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const result = validateLead(body);
  if (!result.ok) return NextResponse.json({ ok: false, errors: result.errors }, { status: 422 });

  // Honeypot filled → pretend success, drop silently.
  if (result.lead.company) return NextResponse.json({ ok: true, id: "ok" });

  const { id, delivered } = await deliverLead(result.lead);
  if (!delivered) {
    return NextResponse.json({ ok: false, error: "We couldn't send that just now. Please try WhatsApp." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id });
}
