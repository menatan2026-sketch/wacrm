import { isLocalStorage } from "@mfg/core";
import { deps } from "@/lib/platform";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  glb: "model/gltf-binary",
  stl: "model/stl",
  "3mf": "model/3mf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

/** Local-storage equivalent of an S3 presigned GET: short-lived signed token, private caching only. */
export async function GET(request: Request) {
  const storage = deps().storage;
  if (!isLocalStorage(storage)) return new Response(null, { status: 404 });
  const claim = storage.verifyDownload(new URL(request.url).searchParams.get("token") ?? "");
  if (!claim) return new Response(null, { status: 403 });
  const ext = claim.k.split(".").pop() ?? "";
  const body = await storage.get(claim.k);
  const inline = ext === "glb" || ["jpg", "jpeg", "png", "webp"].includes(ext);
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(claim.fn)}`,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
