import * as drafts from "../../src/modules/drafts/service";
import type { Harness } from "./harness";

export const USAGE = {
  environment: "indoor",
  heat: "none",
  load: "light",
  flexibility: "rigid",
  appearance: "clean",
} as const;

/** Guest uploads, answers usage, signs in, submits → instant quote. */
export async function quotedOrder(h: Harness, email = "dana@example.com") {
  const guest = { kind: "guest" as const, anonKey: `anon-${Math.random()}` };
  const draft = await drafts.startDraft(h.ctx(guest), "file");
  const fileId = await h.uploadModel(guest);
  await h.drain(); // geometry analysis
  await drafts.saveDraft(h.ctx(guest), draft.id, {
    step: "usage",
    patch: { fileId, units: "mm", usage: USAGE, quantity: 2 },
  });
  const preview = await drafts.evaluateDraft(h.ctx(guest), draft.id);
  const customer = await h.signIn(email);
  await drafts.claimDrafts(h.ctx(customer), guest.anonKey, customer.userId);
  const { orderId, outcome } = await drafts.submitDraft(h.d, h.ctx(customer), draft.id, "en");
  return { orderId, outcome, customer, preview, fileId };
}
