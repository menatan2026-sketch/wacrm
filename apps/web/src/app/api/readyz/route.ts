import { sql } from "@mfg/db";
import { platform } from "@/lib/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Readiness: database and Redis reachable. Geometry is reported but does not fail readiness. */
export async function GET() {
  const p = platform();
  const checks: Record<string, boolean> = {};
  try {
    await p.deps.db.execute(sql`SELECT 1`);
    checks.database = true;
  } catch {
    checks.database = false;
  }
  try {
    checks.redis = (await p.redis.ping()) === "PONG";
  } catch {
    checks.redis = false;
  }
  try {
    const res = await fetch(`${process.env.GEOMETRY_URL ?? "http://127.0.0.1:8001"}/healthz`, { signal: AbortSignal.timeout(1500) });
    checks.geometry = res.ok;
  } catch {
    checks.geometry = false;
  }
  const ready = checks.database && checks.redis;
  return Response.json({ status: ready ? "ready" : "not_ready", checks }, { status: ready ? 200 : 503 });
}
