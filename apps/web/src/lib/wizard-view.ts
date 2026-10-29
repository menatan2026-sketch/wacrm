import "server-only";
import type { drafts } from "@mfg/core";
import type { AppLocale } from "@mfg/i18n";
import { catalogDescription, catalogName } from "./i18n";

type Evaluation = Awaited<ReturnType<typeof drafts.evaluateDraft>>;

/** Serializable, localized view of a draft evaluation for the wizard client. */
export function wizardView(e: Evaluation, locale: AppLocale, catalog: { id: string; code: string; i18n: unknown; maxServiceTempC: number; uvResistance: number; strengthIndex: number; variants: { id: string; i18n: unknown }[] }[]) {
  const byId = new Map(catalog.map((m) => [m.id, m]));
  const variantNames = new Map(catalog.flatMap((m) => m.variants.map((v) => [v.id, catalogName(v.i18n as never, locale, "")])));
  return {
    analysis: e.analysis
      ? {
          status: e.analysis.status,
          stages: e.analysis.stages.map((s) => ({ stage: s.stage, status: s.status })),
          failureCode: e.analysis.failureCode,
          warnings: e.analysis.warnings,
          unitsDetected: e.analysis.unitsDetected,
          rawBboxMm: e.analysis.bboxXMm != null ? [e.analysis.bboxXMm, e.analysis.bboxYMm!, e.analysis.bboxZMm!] : null,
          previewFileId: e.analysis.previewFileId,
        }
      : null,
    dimensionsMm: e.dimensionsMm,
    rationale: e.requirements?.rationale ?? [],
    qualityProfile: e.requirements?.qualityProfile ?? null,
    materials: e.materials.map((m) => {
      const full = byId.get(m.materialId);
      return {
        id: m.materialId,
        code: m.code,
        name: catalogName(full?.i18n as never, locale, m.code),
        description: catalogDescription(full?.i18n as never, locale),
        recommended: m.recommended,
        costTier: m.costTier,
        heat: full?.maxServiceTempC ?? 0,
        uv: full?.uvResistance ?? 0,
        strength: full?.strengthIndex ?? 0,
        variants: m.variants.map((v) => ({ id: v.id, hex: v.colorHex, name: variantNames.get(v.id) ?? v.colorCode })),
      };
    }),
    selectedVariantId: e.selectedVariantId,
    price: e.price
      ? { totalMinor: e.price.totalMinor, taxMinor: e.price.taxMinor, taxRateBps: e.taxRateBps, subtotalNetMinor: e.price.subtotalNetMinor, currency: e.price.currency, leadDays: e.price.leadDays, lines: e.price.lines.map((l) => ({ labelKey: l.labelKey, amountNetMinor: l.amountNetMinor })) }
      : null,
    reviewReasons: e.reviewReasons,
  };
}
export type WizardView = ReturnType<typeof wizardView>;
