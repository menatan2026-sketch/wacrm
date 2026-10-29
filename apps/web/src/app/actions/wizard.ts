"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { catalog, drafts, files, randomTokenForCookie } from "@/lib/wizard-deps";
import { isLocale } from "@mfg/i18n";
import { run } from "@/lib/actions";
import { deps } from "@/lib/platform";
import { ANON_COOKIE, ctxFor, getActor, guestOrUser } from "@/lib/session";
import { wizardView } from "@/lib/wizard-view";

/** Start a new order draft (guest or signed in) and open the wizard. */
export async function startDraftAction(flow: "file" | "object" | "idea", locale: string) {
  z.enum(["file", "object", "idea"]).parse(flow);
  const jar = await cookies();
  let actor = await guestOrUser();
  if (actor.kind === "guest" && !actor.anonKey) {
    const anonKey = randomTokenForCookie();
    jar.set(ANON_COOKIE, anonKey, { httpOnly: true, sameSite: "lax", path: "/", secure: (process.env.APP_URL ?? "").startsWith("https://"), maxAge: 30 * 24 * 3600 });
    actor = { kind: "guest", anonKey };
  }
  const draft = await drafts.startDraft(await ctxFor(actor), flow);
  redirect(`/${isLocale(locale) ? locale : "he"}/new/${draft.id}`);
}

export async function saveDraftAction(draftId: string, step: string | undefined, patch: unknown) {
  return run(async () => {
    const row = await drafts.saveDraft(await ctxFor(await guestOrUser()), draftId, { step, patch });
    return { step: row.step };
  });
}

export async function evaluateDraftAction(draftId: string, locale: string) {
  return run(async () => {
    const ctx = await ctxFor(await guestOrUser());
    const [evaluation, mats] = await Promise.all([drafts.evaluateDraft(ctx, draftId), catalog.listMaterials(ctx)]);
    return wizardView(evaluation, isLocale(locale) ? locale : "he", mats);
  });
}

export async function createUploadAction(input: { fileName: string; size: number; kind: "model" | "photo" }) {
  return run(async () => files.createUploadSession(deps(), await ctxFor(await guestOrUser()), input));
}

export async function completeUploadAction(fileId: string) {
  return run(async () => {
    const f = await files.completeUpload(deps(), await ctxFor(await guestOrUser()), fileId);
    return { id: f.id, name: f.originalName };
  });
}

/** Submit requires a signed-in customer; guests are sent to sign in and come back with progress saved. */
export async function submitDraftAction(draftId: string, locale: string) {
  const user = await getActor("customer");
  if (!user) redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/new/${draftId}`)}`);
  const result = await run(async () => drafts.submitDraft(deps(), await ctxFor(user), draftId, locale));
  if (!result.ok) return result;
  redirect(`/${locale}/orders/${result.data.orderId}`);
}
