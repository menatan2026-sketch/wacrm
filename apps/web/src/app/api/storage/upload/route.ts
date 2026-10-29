import { isLocalStorage } from "@mfg/core";
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
  const declared = Number(request.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared !== claim.n)
    return Response.json({ code: "files.size_mismatch" }, { status: 400 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length !== claim.n)
    return Response.json({ code: "files.size_mismatch" }, { status: 400 });
  await storage.put(claim.k, body);
  return new Response(null, { status: 200 });
}
