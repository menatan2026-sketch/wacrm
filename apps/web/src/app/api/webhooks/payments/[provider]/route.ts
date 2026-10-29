import { payments } from "@mfg/core";
import { logger } from "@mfg/logging";
import { deps } from "@/lib/platform";

export const runtime = "nodejs";

/** PSP webhook: raw body is verified by the provider adapter, de-duplicated and processed in one transaction. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const d = deps();
  if (provider !== d.payments.name) return new Response(null, { status: 404 });
  const raw = await request.text();
  if (raw.length > 64 * 1024) return new Response(null, { status: 413 });
  const headers = Object.fromEntries(request.headers.entries());
  const outcome = await payments.handlePaymentWebhook(d, raw, headers);
  if (outcome === "invalid") {
    logger().warn({ provider }, "rejected payment webhook with invalid signature");
    return new Response(null, { status: 401 });
  }
  return Response.json({ received: true, outcome });
}
