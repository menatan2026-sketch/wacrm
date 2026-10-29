import { DomainError, files } from "@mfg/core";
import { deps } from "@/lib/platform";
import { ctxFor, getActor, guestOrUser } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Authorized file access for previews and photos: resolves the caller on any surface, checks
 * permissions in the files module (owner, staff, or supplier with an active job), audits the
 * access, and redirects to a 5-minute signed URL. Files are never public.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purpose = new URL(request.url).searchParams.get("purpose") ?? "view";
  const actor = (await getActor("admin")) ?? (await getActor("supplier")) ?? (await guestOrUser());
  try {
    const url = await files.getDownloadUrl(deps(), await ctxFor(actor), id, purpose.slice(0, 40));
    return Response.redirect(url, 302);
  } catch (err) {
    if (err instanceof DomainError) return new Response(null, { status: err.status === 403 ? 403 : 404 });
    throw err;
  }
}
