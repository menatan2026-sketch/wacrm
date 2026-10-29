export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness: the process is up. */
export function GET() {
  return Response.json({ status: "ok" });
}
