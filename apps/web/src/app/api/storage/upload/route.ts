import { isLocalStorage } from "@mfg/core";
import { logger } from "@mfg/logging";
import { deps } from "@/lib/platform";

export const runtime = "nodejs";

/**
 * Local-storage equivalent of an S3 presigned PUT (development and CI). The signed token fixes the
 * key, content type and exact byte length; anything else is rejected.
 */
export async function PUT(request: Request) {
  const storage = deps().storage;
  if (!isLocalStorage(storage)) return new Response(null, { status: 404 });
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const claim = storage.verifyUpload(token);
  if (!claim) return Response.json({ code: "files.upload_expired" }, { status: 403 });
  if (request.headers.get("content-type") !== claim.ct)
    return Response.json({ code: "files.type_not_allowed" }, { status: 415 });
  // Require the exact signed length up front, so an oversized or chunked body is never buffered.
  const declared = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(declared)) return new Response(null, { status: 411 });
  if (declared !== claim.n) return Response.json({ code: "files.size_mismatch" }, { status: 400 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length !== claim.n)
    return Response.json({ code: "files.size_mismatch" }, { status: 400 });
  try {
    await storage.put(claim.k, body);
  } catch (err) {
    logger().error({ err }, "local storage write failed");
    return Response.json({ code: "common.unexpected" }, { status: 500 });
  }
  return new Response(null, { status: 200 });
}
