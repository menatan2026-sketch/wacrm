import { schema, eq, inArray, type CatalogI18n } from "@mfg/db";
import type { Ctx } from "../../shared/context";
import { qcRequirements } from "./qc-spec";

export interface PartSummary {
  quantity: number;
  materialCode: string | null;
  materialI18n: CatalogI18n | null;
  colorI18n: CatalogI18n | null;
  colorHex: string | null;
  sizeMm: [number, number, number] | null;
}

/**
 * What a supplier needs to judge an offer or job at a glance: material, colour, quantity, size.
 * Contains no customer data. Callers must already have authorized access to these orders.
 */
export async function partSummaries(
  ctx: Ctx,
  orderIds: string[],
): Promise<Map<string, PartSummary>> {
  const out = new Map<string, PartSummary>();
  if (!orderIds.length) return out;
  const rows = await ctx.db
    .select({
      orderId: schema.orderItems.orderId,
      quantity: schema.orderItems.quantity,
      variant: schema.materialVariants,
      material: schema.materials,
    })
    .from(schema.orderItems)
    .leftJoin(
      schema.materialVariants,
      eq(schema.materialVariants.id, schema.orderItems.materialVariantId),
    )
    .leftJoin(schema.materials, eq(schema.materials.id, schema.materialVariants.materialId))
    .where(inArray(schema.orderItems.orderId, orderIds));
  for (const orderId of new Set(orderIds)) {
    const item = rows.find((r) => r.orderId === orderId);
    const { measurements } = await qcRequirements(ctx, orderId);
    out.set(orderId, {
      quantity: rows.filter((r) => r.orderId === orderId).reduce((s, r) => s + r.quantity, 0),
      materialCode: item?.material?.code ?? null,
      materialI18n: item?.material?.i18n ?? null,
      colorI18n: item?.variant?.i18n ?? null,
      colorHex: item?.variant?.colorHex ?? null,
      sizeMm:
        measurements.length === 3
          ? (measurements.map((m) => m.expectedMm) as [number, number, number])
          : null,
    });
  }
  return out;
}
