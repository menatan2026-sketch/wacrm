import { schema, uuidv7, eq } from "@mfg/db";
import type { Deps } from "../../deps";
import type { Ctx } from "../../shared/context";
import { logger } from "@mfg/logging";

/**
 * Worker handler for `file.uploaded`: fetch the object with internal credentials, analyze it in the
 * sandboxed geometry service, and persist the result. Failures are stored as typed codes so the
 * customer sees a plain-language reason and can continue to manual review.
 */
export async function analyzeFile(d: Deps, ctx: Ctx, fileId: string): Promise<void> {
  const [file] = await ctx.db.select().from(schema.fileObjects).where(eq(schema.fileObjects.id, fileId));
  if (!file || file.kind !== "model") return;
  const [analysis] = await ctx.db.select().from(schema.geometryAnalyses).where(eq(schema.geometryAnalyses.fileId, fileId));
  if (analysis && (analysis.status === "succeeded" || analysis.status === "failed")) return;
  await ctx.db.update(schema.geometryAnalyses).set({ status: "running" }).where(eq(schema.geometryAnalyses.fileId, fileId));

  let result;
  try {
    result = await d.geometry.analyze(file.originalName, await d.storage.get(file.storageKey));
  } catch (err) {
    logger().error({ err, fileId }, "geometry analysis call failed");
    // Leave it retryable by the queue; mark as queued again so the UI keeps showing "analyzing".
    await ctx.db.update(schema.geometryAnalyses).set({ status: "queued" }).where(eq(schema.geometryAnalyses.fileId, fileId));
    throw err;
  }

  const at = ctx.clock.now().toISOString();
  const stages = result.stages.map((s) => ({ ...s, at }));
  if (!result.ok) {
    await ctx.db
      .update(schema.geometryAnalyses)
      .set({ status: "failed", failureCode: result.failure_code, stages, analyzerVersion: result.analyzer_version, durationMs: result.duration_ms })
      .where(eq(schema.geometryAnalyses.fileId, fileId));
    return;
  }

  let previewFileId: string | null = null;
  if (result.preview_glb_b64) {
    previewFileId = uuidv7();
    const body = Buffer.from(result.preview_glb_b64, "base64");
    const key = `preview/${ctx.clock.now().getUTCFullYear()}/${previewFileId}.glb`;
    await d.storage.put(key, body, "model/gltf-binary");
    await ctx.db.insert(schema.fileObjects).values({
      id: previewFileId,
      ownerUserId: file.ownerUserId,
      anonTokenHash: file.anonTokenHash,
      storageKey: key,
      originalName: `${file.originalName}.preview.glb`,
      ext: "glb",
      mime: "model/gltf-binary",
      sizeBytes: body.length,
      kind: "preview",
      status: "uploaded",
      retentionClass: file.retentionClass,
      uploadedAt: ctx.clock.now(),
    });
  }
  const m = result.metrics;
  await ctx.db
    .update(schema.geometryAnalyses)
    .set({
      status: "succeeded",
      stages,
      unitsDetected: m.units_detected,
      bboxXMm: m.bbox_mm[0],
      bboxYMm: m.bbox_mm[1],
      bboxZMm: m.bbox_mm[2],
      volumeMm3: m.volume_mm3,
      surfaceAreaMm2: m.surface_area_mm2,
      overhangAreaMm2: m.overhang_area_mm2,
      triangleCount: m.triangle_count,
      shells: m.shells,
      isWatertight: m.is_watertight,
      warnings: result.warnings,
      previewFileId,
      analyzerVersion: result.analyzer_version,
      durationMs: result.duration_ms,
    })
    .where(eq(schema.geometryAnalyses.fileId, fileId));
}

export async function getAnalysis(ctx: Ctx, fileId: string) {
  const [row] = await ctx.db.select().from(schema.geometryAnalyses).where(eq(schema.geometryAnalyses.fileId, fileId));
  return row ?? null;
}

/** Dimensions after the customer's unit confirmation and optional scaling. */
export function scaledGeometry(a: NonNullable<Awaited<ReturnType<typeof getAnalysis>>>, units: "mm" | "in", scale: number) {
  const f = (units === "in" ? 25.4 : 1) * scale;
  return {
    bboxMm: [a.bboxXMm! * f, a.bboxYMm! * f, a.bboxZMm! * f] as [number, number, number],
    volumeMm3: a.volumeMm3! * f ** 3,
    surfaceAreaMm2: a.surfaceAreaMm2! * f ** 2,
    overhangAreaMm2: (a.overhangAreaMm2 ?? 0) * f ** 2,
  };
}
