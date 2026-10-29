"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { files, production, routing, suppliers } from "@mfg/core";
import { run } from "@/lib/actions";
import { partnerContext } from "@/lib/partner";
import { deps } from "@/lib/platform";

const DECLINE_REASONS = ["capacity", "material", "deadline", "other"] as const;

export async function respondToOfferAction(
  locale: string,
  offerId: string,
  accept: boolean,
  declineReason?: string,
) {
  return run(async () => {
    const { ctx } = await partnerContext(locale);
    const reason = accept ? undefined : z.enum(DECLINE_REASONS).parse(declineReason);
    const result = await routing.respondToOffer(deps(), ctx, z.uuid().parse(offerId), {
      accept,
      declineReason: reason,
    });
    revalidatePath(`/${locale}/partners`);
    return { rerouted: result.rerouted };
  });
}

export async function startProductionAction(locale: string, jobId: string) {
  return run(async () => {
    const { ctx } = await partnerContext(locale);
    await production.startProduction(ctx, z.uuid().parse(jobId));
    revalidatePath(`/${locale}/partners/jobs/${jobId}`);
  });
}

export async function createQcUploadAction(
  locale: string,
  input: { fileName: string; size: number },
) {
  return run(async () =>
    files.createUploadSession(deps(), (await partnerContext(locale)).ctx, {
      ...input,
      kind: "qc_photo",
    }),
  );
}

export async function completeQcUploadAction(locale: string, fileId: string) {
  return run(async () => {
    const f = await files.completeUpload(deps(), (await partnerContext(locale)).ctx, fileId);
    return { id: f.id };
  });
}

export async function submitEvidenceAction(locale: string, jobId: string, evidence: unknown) {
  return run(async () => {
    const { ctx } = await partnerContext(locale);
    await production.submitEvidence(ctx, z.uuid().parse(jobId), evidence);
    revalidatePath(`/${locale}/partners/jobs/${jobId}`);
  });
}

export async function saveProfileAction(locale: string, input: unknown) {
  return run(async () => {
    const { ctx, supplierId } = await partnerContext(locale);
    await suppliers.updateSupplierProfile(ctx, supplierId, input);
    revalidatePath(`/${locale}/partners/profile`);
  });
}

export async function saveMachineAction(locale: string, input: unknown, machineId?: string) {
  return run(async () => {
    const { ctx, supplierId } = await partnerContext(locale);
    const id = await suppliers.upsertMachine(
      ctx,
      supplierId,
      input,
      machineId ? z.uuid().parse(machineId) : undefined,
    );
    revalidatePath(`/${locale}/partners/profile`);
    return id;
  });
}

export async function savePayoutDetailsAction(
  locale: string,
  input: { accountName: string; bank: string; branch: string; account: string },
) {
  return run(async () => {
    const { ctx, supplierId } = await partnerContext(locale);
    await suppliers.setPayoutDetails(ctx, supplierId, input);
    revalidatePath(`/${locale}/partners/profile`);
  });
}

export async function acceptAgreementAction(locale: string) {
  return run(async () => {
    const { ctx, supplierId } = await partnerContext(locale);
    await suppliers.acceptAgreement(ctx, supplierId);
    revalidatePath(`/${locale}/partners/profile`);
  });
}
