import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, oneOf, updatedAt } from "./_shared";

/** Per-locale display strings for admin-managed catalog content. */
export type CatalogI18n = Partial<
  Record<"he" | "en" | "ru", { name: string; description?: string }>
>;

export const processes = pgTable(
  "processes",
  {
    code: text("code").primaryKey(),
    status: text("status").notNull().default("inactive"),
    sort: integer("sort").notNull().default(0),
    i18n: jsonb("i18n").$type<CatalogI18n>().notNull().default({}),
  },
  () => [oneOf("processes_status_ck", "status", ["active", "inactive"])],
);

export const materials = pgTable(
  "materials",
  {
    id: id(),
    code: text("code").notNull(),
    processCode: text("process_code")
      .notNull()
      .references(() => processes.code),
    status: text("status").notNull().default("active"),
    densityGCm3: numeric("density_g_cm3", { precision: 6, scale: 3, mode: "number" }).notNull(),
    maxServiceTempC: integer("max_service_temp_c").notNull(),
    uvResistance: integer("uv_resistance").notNull(),
    moistureResistance: integer("moisture_resistance").notNull(),
    flexibility: text("flexibility").$type<"rigid" | "slight" | "rubber">().notNull(),
    strengthIndex: integer("strength_index").notNull(),
    foodContactCertifiable: boolean("food_contact_certifiable").notNull().default(false),
    costTier: integer("cost_tier").notNull().default(1),
    sort: integer("sort").notNull().default(0),
    i18n: jsonb("i18n").$type<CatalogI18n>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("materials_code_uq").on(t.code),
    oneOf("materials_status_ck", "status", ["active", "inactive"]),
    oneOf("materials_flex_ck", "flexibility", ["rigid", "slight", "rubber"]),
  ],
);

export const materialVariants = pgTable(
  "material_variants",
  {
    id: id(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    colorCode: text("color_code").notNull(),
    colorHex: text("color_hex").notNull(),
    status: text("status").notNull().default("active"),
    sort: integer("sort").notNull().default(0),
    i18n: jsonb("i18n").$type<CatalogI18n>().notNull().default({}),
  },
  (t) => [
    uniqueIndex("material_variants_uq").on(t.materialId, t.colorCode),
    oneOf("material_variants_status_ck", "status", ["active", "inactive"]),
  ],
);

export const qualityProfiles = pgTable(
  "quality_profiles",
  {
    code: text("code").primaryKey(),
    processCode: text("process_code")
      .notNull()
      .references(() => processes.code),
    layerHeightMm: numeric("layer_height_mm", { precision: 5, scale: 3, mode: "number" }).notNull(),
    wallThicknessMm: numeric("wall_thickness_mm", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    infill: numeric("infill", { precision: 4, scale: 3, mode: "number" }).notNull(),
    sort: integer("sort").notNull().default(0),
    status: text("status").notNull().default("active"),
  },
  () => [oneOf("quality_profiles_status_ck", "status", ["active", "inactive"])],
);
