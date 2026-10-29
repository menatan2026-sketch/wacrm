import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { catalog, drafts, DomainError } from "@mfg/core";
import { useLocaleParam } from "@/lib/i18n";
import { deps } from "@/lib/platform";
import { ctxFor, getActor, guestOrUser } from "@/lib/session";
import { wizardView } from "@/lib/wizard-view";
import { Wizard } from "./Wizard";

export async function generateMetadata() {
  const t = await getTranslations("navigation.customer");
  return { title: t("newOrder") };
}

export default async function WizardPage({ params }: { params: Promise<{ locale: string; draftId: string }> }) {
  const locale = await useLocaleParam(params);
  const { draftId } = await params;
  const ctx = await ctxFor(await guestOrUser());
  let draft;
  try {
    draft = await drafts.getDraft(ctx, draftId);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  if (draft.convertedOrderId) {
    const { redirect } = await import("next/navigation");
    redirect(`/${locale}/orders/${draft.convertedOrderId}`);
  }
  const [evaluation, mats] = await Promise.all([drafts.evaluateDraft(ctx, draftId), catalog.listMaterials(ctx)]);
  const signedIn = Boolean(await getActor("customer"));
  return (
    <Wizard
      draft={{ id: draft.id, flow: draft.flow as "file" | "object" | "idea", step: draft.step, payload: draft.payload as Record<string, unknown> }}
      steps={[...drafts.STEPS[draft.flow as "file"]]}
      initialView={wizardView(evaluation, locale, mats)}
      signedIn={signedIn}
      maxModelMb={Math.round(deps().limits.maxModelBytes / 1048576)}
    />
  );
}
