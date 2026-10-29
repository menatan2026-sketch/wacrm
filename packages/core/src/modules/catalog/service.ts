import { schema, asc, eq, inArray } from "@mfg/db";
import type { Ctx } from "../../shared/context";
import { audit } from "../../platform/audit";
import { authorize } from "../identity/rbac";
import { notFound } from "../../shared/errors";

export async function listMaterials(ctx: Ctx, opts: { includeInactive?: boolean } = {}) {
  const mats = await ctx.db.select().from(schema.materials).orderBy(asc(schema.materials.sort));
  const variants = await ctx.db
    .select()
    .from(schema.materialVariants)
    .orderBy(asc(schema.materialVariants.sort));
  return mats
    .filter((m) => opts.includeInactive || m.status === "active")
    .map((m) => ({
      ...m,
      variants: variants.filter(
        (v) => v.materialId === m.id && (opts.includeInactive || v.status === "active"),
      ),
    }));
}

export async function getVariant(ctx: Ctx, variantId: string) {
  const [row] = await ctx.db
    .select({ variant: schema.materialVariants, material: schema.materials })
    .from(schema.materialVariants)
    .innerJoin(schema.materials, eq(schema.materials.id, schema.materialVariants.materialId))
    .where(eq(schema.materialVariants.id, variantId));
  if (!row) throw notFound("material_variant");
  return row;
}

export async function listQualityProfiles(ctx: Ctx) {
  return ctx.db
    .select()
    .from(schema.qualityProfiles)
    .where(eq(schema.qualityProfiles.status, "active"))
    .orderBy(asc(schema.qualityProfiles.sort));
}

export async function setMaterialStatus(
  ctx: Ctx,
  materialId: string,
  status: "active" | "inactive",
  reason: string,
) {
  authorize(ctx.actor, "catalog.manage");
  const [before] = await ctx.db
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.id, materialId));
  if (!before) throw notFound("material");
  await ctx.db.update(schema.materials).set({ status }).where(eq(schema.materials.id, materialId));
  await audit(ctx, {
    action: "catalog.material_status",
    resourceType: "material",
    resourceId: materialId,
    before: { status: before.status },
    after: { status },
    reason,
  });
}

export async function setVariantStatus(
  ctx: Ctx,
  variantIds: string[],
  status: "active" | "inactive",
  reason: string,
) {
  authorize(ctx.actor, "catalog.manage");
  await ctx.db
    .update(schema.materialVariants)
    .set({ status })
    .where(inArray(schema.materialVariants.id, variantIds));
  await audit(ctx, {
    action: "catalog.variant_status",
    resourceType: "material_variant",
    resourceId: variantIds.join(","),
    after: { status },
    reason,
  });
}
