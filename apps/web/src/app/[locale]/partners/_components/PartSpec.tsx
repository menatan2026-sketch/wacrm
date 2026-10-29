import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@mfg/i18n";
import { formatNumber } from "@mfg/i18n";
import { Ltr } from "@mfg/ui";
import { catalogName } from "@/lib/i18n";

export interface PartView {
  quantity: number;
  materialCode: string | null;
  materialI18n: Partial<Record<string, { name: string }>> | null;
  colorI18n: Partial<Record<string, { name: string }>> | null;
  colorHex: string | null;
  sizeMm: [number, number, number] | null;
}

/** Material · colour · quantity · size, as a compact definition list. */
export async function PartSpec({ part, locale }: { part: PartView; locale: AppLocale }) {
  const t = await getTranslations("supplier.offer");
  const u = await getTranslations("common.units");
  const material = part.materialCode ? catalogName(part.materialI18n, locale, part.materialCode) : "—";
  const color = part.colorI18n ? catalogName(part.colorI18n, locale, "") : "";
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-text-secondary">{t("material")}</dt>
        <dd className="flex items-center gap-2 font-medium">
          {part.colorHex && <span aria-hidden className="size-3 rounded-full border border-border-default" style={{ backgroundColor: part.colorHex }} />}
          {material}
          {color && <span className="text-text-secondary">· {color}</span>}
        </dd>
      </div>
      <div>
        <dt className="text-text-secondary">{t("quantity")}</dt>
        <dd className="font-medium tabular-nums">{formatNumber(part.quantity, locale, 0)}</dd>
      </div>
      {part.sizeMm && (
        <div>
          <dt className="text-text-secondary">{t("size")}</dt>
          <dd className="font-medium">
            <Ltr mono>
              {part.sizeMm.map((v) => formatNumber(v, locale, 1)).join(" × ")} {u("mm")}
            </Ltr>
          </dd>
        </div>
      )}
    </dl>
  );
}
