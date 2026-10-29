import { bigint, boolean, index, integer, jsonb, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, oneOf, ts, updatedAt } from "./_shared";
import { FILE_KINDS } from "./enums";
import { users } from "./identity";

export const fileObjects = pgTable(
  "file_objects",
  {
    id: id(),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    anonTokenHash: text("anon_token_hash"),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    ext: text("ext").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256"),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("pending_upload"),
    retentionClass: text("retention_class").notNull().default("draft"),
    createdAt: createdAt(),
    uploadedAt: ts("uploaded_at"),
  },
  (t) => [
    uniqueIndex("file_objects_key_uq").on(t.storageKey),
    index("file_objects_owner_idx").on(t.ownerUserId),
    oneOf("file_objects_kind_ck", "kind", FILE_KINDS),
    oneOf("file_objects_status_ck", "status", ["pending_upload", "uploaded", "rejected", "deleted"]),
  ],
);

export interface GeometryStage {
  stage: string;
  status: "done" | "failed";
  at: string;
}

export const geometryAnalyses = pgTable(
  "geometry_analyses",
  {
    id: id(),
    fileId: uuid("file_id").notNull().references(() => fileObjects.id),
    status: text("status").notNull().default("queued"),
    stages: jsonb("stages").$type<GeometryStage[]>().notNull().default([]),
    failureCode: text("failure_code"),
    unitsDetected: text("units_detected"),
    bboxXMm: numeric("bbox_x_mm", { precision: 12, scale: 3, mode: "number" }),
    bboxYMm: numeric("bbox_y_mm", { precision: 12, scale: 3, mode: "number" }),
    bboxZMm: numeric("bbox_z_mm", { precision: 12, scale: 3, mode: "number" }),
    volumeMm3: numeric("volume_mm3", { precision: 16, scale: 3, mode: "number" }),
    surfaceAreaMm2: numeric("surface_area_mm2", { precision: 16, scale: 3, mode: "number" }),
    overhangAreaMm2: numeric("overhang_area_mm2", { precision: 16, scale: 3, mode: "number" }),
    triangleCount: integer("triangle_count"),
    shells: integer("shells"),
    isWatertight: boolean("is_watertight"),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    previewFileId: uuid("preview_file_id").references(() => fileObjects.id),
    analyzerVersion: text("analyzer_version"),
    durationMs: integer("duration_ms"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("geometry_analyses_file_uq").on(t.fileId),
    oneOf("geometry_analyses_status_ck", "status", ["queued", "running", "succeeded", "failed"]),
  ],
);
