import { schema, uuidv7, and, eq, sql, type FileKind } from "@mfg/db";
import type { Deps } from "../../deps";
import { audit } from "../../platform/audit";
import { publish } from "../../platform/outbox";
import { track } from "../../platform/analytics";
import { enforce } from "../../platform/rate-limit";
import type { Actor, Ctx } from "../../shared/context";
import { sha256 } from "../../shared/crypto";
import { DomainError, forbidden, invalid, notFound } from "../../shared/errors";
import { inTx } from "../../shared/tx";
import { can, isStaff, supplierScopes } from "../identity/rbac";

/** Allowed uploads per kind: extension → content type. STEP/OBJ are deferred (KNOWN_ISSUES KI-008). */
export const ALLOWED: Record<"model" | "photo" | "qc_photo", Record<string, string>> = {
  model: { stl: "model/stl", "3mf": "model/3mf" },
  photo: { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp" },
  qc_photo: { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", webp: "image/webp" },
};

const UPLOAD_URL_TTL_S = 5 * 60;
const DOWNLOAD_URL_TTL_S = 5 * 60;
const DAILY_UPLOAD_LIMIT = 60;

const ownerOf = (actor: Actor) =>
  actor.kind === "user" ? { ownerUserId: actor.userId, anonTokenHash: null } : actor.kind === "guest" && actor.anonKey ? { ownerUserId: null, anonTokenHash: sha256(actor.anonKey) } : null;

export interface UploadSession {
  fileId: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string>; expiresAt: string };
}

export async function createUploadSession(d: Deps, ctx: Ctx, input: { fileName: string; size: number; kind: "model" | "photo" | "qc_photo" }): Promise<UploadSession> {
  const owner = ownerOf(ctx.actor);
  if (!owner) throw new DomainError("auth.unauthenticated", 401);
  const ext = input.fileName.toLowerCase().split(".").pop() ?? "";
  const contentType = ALLOWED[input.kind][ext];
  if (!contentType) throw invalid("files.type_not_allowed", { ext });
  const max = input.kind === "model" ? d.limits.maxModelBytes : d.limits.maxPhotoBytes;
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > max) throw invalid("files.too_large", { max });
  await enforce(d.rateLimiter, `upload:${owner.ownerUserId ?? owner.anonTokenHash}`, DAILY_UPLOAD_LIMIT, 24 * 3600);

  const fileId = uuidv7();
  const storageKey = `${input.kind}/${ctx.clock.now().getUTCFullYear()}/${fileId}.${ext}`;
  await ctx.db.insert(schema.fileObjects).values({
    id: fileId,
    ...owner,
    storageKey,
    originalName: input.fileName.slice(0, 200),
    ext,
    mime: contentType,
    sizeBytes: input.size,
    kind: input.kind as FileKind,
  });
  if (input.kind === "model") await track(ctx, "upload_started", { ext, size: input.size });
  const upload = await d.storage.presignUpload(storageKey, contentType, input.size, UPLOAD_URL_TTL_S);
  return { fileId, upload: { ...upload, expiresAt: upload.expiresAt.toISOString() } };
}

export async function getOwnedFile(ctx: Ctx, fileId: string) {
  const [file] = await ctx.db.select().from(schema.fileObjects).where(eq(schema.fileObjects.id, fileId));
  if (!file) throw notFound("file");
  const owner = ownerOf(ctx.actor);
  const owns = owner && ((owner.ownerUserId && file.ownerUserId === owner.ownerUserId) || (owner.anonTokenHash && file.anonTokenHash === owner.anonTokenHash));
  if (!owns) throw forbidden();
  return file;
}

/** Confirm the object landed with the declared size; models then go to geometry analysis. */
export async function completeUpload(d: Deps, ctx: Ctx, fileId: string) {
  return inTx(ctx, async (ctx) => {
    const file = await getOwnedFile(ctx, fileId);
    if (file.status === "uploaded") return file;
    const head = await d.storage.head(file.storageKey);
    if (!head) throw invalid("files.not_uploaded");
    if (head.size !== file.sizeBytes) {
      await ctx.db.update(schema.fileObjects).set({ status: "rejected" }).where(eq(schema.fileObjects.id, file.id));
      throw invalid("files.size_mismatch");
    }
    const [updated] = await ctx.db
      .update(schema.fileObjects)
      .set({ status: "uploaded", uploadedAt: ctx.clock.now() })
      .where(eq(schema.fileObjects.id, file.id))
      .returning();
    if (file.kind === "model") {
      await ctx.db.insert(schema.geometryAnalyses).values({ id: uuidv7(), fileId: file.id }).onConflictDoNothing();
      await publish(ctx, "file.uploaded", { fileId: file.id });
      await track(ctx, "upload_completed", { ext: file.ext, size: file.sizeBytes });
    }
    return updated!;
  });
}

/** Transfer guest-owned files to the user who signs in with the same anonymous key. */
export async function claimFiles(ctx: Ctx, anonKey: string, userId: string, fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return;
  for (const id of fileIds) {
    await ctx.db
      .update(schema.fileObjects)
      .set({ ownerUserId: userId, anonTokenHash: null })
      .where(and(eq(schema.fileObjects.id, id), eq(schema.fileObjects.anonTokenHash, sha256(anonKey))));
  }
}

/**
 * Authorize and issue a short-lived download URL (SECURITY §4). Customers: own files. Staff: any.
 * Suppliers: only files of orders with an active (accepted, not handed off) job of theirs.
 */
export async function getDownloadUrl(d: Deps, ctx: Ctx, fileId: string, purpose: string): Promise<string> {
  const [file] = await ctx.db.select().from(schema.fileObjects).where(eq(schema.fileObjects.id, fileId));
  if (!file || file.status !== "uploaded") throw notFound("file");
  let allowed = false;
  if (ctx.actor.kind === "user") {
    if (file.ownerUserId === ctx.actor.userId) allowed = true;
    else if (isStaff(ctx.actor) && can(ctx.actor, "order.read.any")) allowed = true;
    else if (supplierScopes(ctx.actor).length) allowed = await supplierMayRead(ctx, file.id, supplierScopes(ctx.actor));
  } else if (ctx.actor.kind === "guest" && ctx.actor.anonKey) {
    allowed = file.anonTokenHash === sha256(ctx.actor.anonKey);
  }
  if (!allowed) throw forbidden();
  await audit(ctx, { action: "file.download", resourceType: "file", resourceId: file.id, after: { purpose } });
  return d.storage.presignDownload(file.storageKey, file.originalName, DOWNLOAD_URL_TTL_S);
}

async function supplierMayRead(ctx: Ctx, fileId: string, supplierIds: string[]): Promise<boolean> {
  const rows = await ctx.db.execute(sql`
    SELECT 1 FROM production_jobs j
    JOIN order_items i ON i.order_id = j.order_id
    LEFT JOIN geometry_analyses g ON g.file_id = i.file_id
    WHERE j.supplier_id IN (${sql.join(supplierIds.map((s) => sql`${s}::uuid`), sql`, `)})
      AND j.status IN ('ACCEPTED','IN_PRODUCTION','QC_PENDING','QC_FAILED')
      AND (i.file_id = ${fileId}::uuid OR g.preview_file_id = ${fileId}::uuid)
    UNION
    SELECT 1 FROM qc_inspections q JOIN production_jobs j ON j.id = q.job_id
    WHERE j.supplier_id IN (${sql.join(supplierIds.map((s) => sql`${s}::uuid`), sql`, `)})
      AND q.photo_file_ids ? ${fileId}
    LIMIT 1`);
  return rows.rows.length > 0;
}

/** Purge uploads that never completed or were abandoned in drafts (retention: 30 days). */
export async function purgeAbandonedFiles(d: Deps, ctx: Ctx): Promise<number> {
  const cutoff = new Date(ctx.clock.now().getTime() - 30 * 24 * 3600 * 1000);
  const stale = await ctx.db
    .select()
    .from(schema.fileObjects)
    .where(and(eq(schema.fileObjects.retentionClass, "draft"), sql`${schema.fileObjects.createdAt} < ${cutoff}`, sql`${schema.fileObjects.status} <> 'deleted'`));
  for (const f of stale) {
    await d.storage.delete(f.storageKey);
    await ctx.db.update(schema.fileObjects).set({ status: "deleted" }).where(eq(schema.fileObjects.id, f.id));
  }
  return stale.length;
}

