"use client";
import { Camera, Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AppLocale } from "@mfg/i18n/config";
import { formatNumber, parseDecimal } from "@mfg/i18n/format";
import { Banner, Button, Card, Field, MeasurementInput, Progress, SectionTitle, Textarea } from "@mfg/ui";
import { completeQcUploadAction, createQcUploadAction, startProductionAction, submitEvidenceAction } from "@/app/actions/partner";
import { useErrorMessage } from "@/lib/errors";
import { putWithProgress } from "@/lib/upload";

const MIN_PHOTOS = 2;

type Photo = { id: string; preview: string };

/** Floor workflow on a phone: start printing → photos (camera) → caliper measurements → checklist → submit. */
export function JobClient({
  locale,
  jobId,
  status,
  measurements,
  checklist,
}: {
  locale: string;
  jobId: string;
  status: "ACCEPTED" | "IN_PRODUCTION";
  measurements: { name: string; expectedMm: number; toleranceMm: number }[];
  checklist: string[];
}) {
  const t = useTranslations("supplier.job");
  const v = useTranslations("validation");
  const u = useTranslations("common.units");
  const appLocale = useLocale() as AppLocale;
  const errorText = useErrorMessage();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [upload, setUpload] = useState<{ n: number; total: number; p: number } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>(Object.fromEntries(checklist.map((c) => [c, false])));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const removePhoto = (photo: Photo) => {
    URL.revokeObjectURL(photo.preview);
    previews.current = previews.current.filter((u) => u !== photo.preview);
    setPhotos((prev) => prev.filter((x) => x.id !== photo.id));
  };

  const addPhotos = async (list: File[]) => {
    setError(undefined);
    for (const [i, file] of list.entries()) {
      setUpload({ n: i + 1, total: list.length, p: 0 });
      const session = await createQcUploadAction(locale, { fileName: file.name || "photo.jpg", size: file.size });
      if (!session.ok) {
        setUpload(null);
        return setError(errorText(session));
      }
      try {
        await putWithProgress(session.data.upload.url, session.data.upload.headers, file, (p) => setUpload({ n: i + 1, total: list.length, p }));
      } catch {
        setUpload(null);
        return setError(errorText({ code: "files.size_mismatch" }));
      }
      const done = await completeQcUploadAction(locale, session.data.fileId);
      if (!done.ok) {
        setUpload(null);
        return setError(errorText(done));
      }
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      setPhotos((prev) => [...prev, { id: done.data.id, preview }]);
    }
    setUpload(null);
  };

  const measured = (name: string) => parseDecimal(values[name] ?? "");
  const outOfTolerance = (m: (typeof measurements)[number]) => {
    const x = measured(m.name);
    return x !== null && Math.abs(x - m.expectedMm) > m.toleranceMm;
  };

  const submit = () =>
    start(async () => {
      setError(undefined);
      const errs: Record<string, string> = {};
      if (photos.length < MIN_PHOTOS) errs.photos = v("minPhotos", { n: MIN_PHOTOS });
      for (const m of measurements) {
        const x = measured(m.name);
        if (x === null) errs[m.name] = v("number");
        else if (x <= 0) errs[m.name] = v("positive");
      }
      setFieldErrors(errs);
      if (Object.keys(errs).length) return setError(v("summary"));
      const r = await submitEvidenceAction(locale, jobId, {
        photoFileIds: photos.map((p) => p.id),
        measurements: measurements.map((m) => ({ name: m.name, measuredMm: measured(m.name)! })),
        checklist: checks,
        notes: notes.trim() || undefined,
      });
      if (!r.ok) return setError(errorText(r));
      router.refresh();
    });

  if (status === "ACCEPTED") {
    return (
      <Card className="flex flex-col gap-4">
        {error && <Banner tone="danger">{error}</Banner>}
        <Button
          size="xl"
          icon={<Play aria-hidden className="size-5" />}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await startProductionAction(locale, jobId);
              if (!r.ok) return setError(errorText(r));
              router.refresh();
            })
          }
        >
          {t("start")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <SectionTitle>{t("evidence")}</SectionTitle>
        <p className="text-sm text-text-secondary">{t("evidenceIntro")}</p>
      </div>
      {error && <Banner tone="danger">{error}</Banner>}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{t("photos")}</legend>
        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((p, i) => (
              <li key={p.id} className="relative aspect-square overflow-hidden rounded-s border border-border-subtle bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={p.preview} alt={t("photoAlt", { n: i + 1 })} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p)}
                  aria-label={t("removePhoto", { n: i + 1 })}
                  className="absolute end-1 top-1 grid size-8 place-items-center rounded-full bg-surface-raised/90 text-text-primary shadow-raised focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          capture="environment"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (list.length) void addPhotos(list.slice(0, 20 - photos.length));
          }}
        />
        <Button variant="secondary" size="lg" icon={<Camera aria-hidden className="size-5" />} disabled={upload !== null || photos.length >= 20} onClick={() => fileInput.current?.click()} className="w-full sm:w-fit">
          {t("addPhoto")}
        </Button>
        {upload && <Progress value={upload.p} label={t("uploading", { n: upload.n, total: upload.total })} />}
        {fieldErrors.photos && <p className="text-sm text-danger">{fieldErrors.photos}</p>}
      </fieldset>

      {measurements.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {measurements.map((m) => (
            <MeasurementInput
              key={m.name}
              label={t("measurement", { axis: m.name.toUpperCase(), expected: formatNumber(m.expectedMm, appLocale, 1), tolerance: formatNumber(m.toleranceMm, appLocale, 2) })}
              value={values[m.name] ?? ""}
              onChange={(raw) => setValues((prev) => ({ ...prev, [m.name]: raw }))}
              unitLabel={u("mm")}
              error={fieldErrors[m.name]}
              hint={outOfTolerance(m) ? t("outOfTolerance") : undefined}
            />
          ))}
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("checklist")}</legend>
        {checklist.map((c) => (
          <label key={c} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-s border border-border-subtle px-3 hover:bg-surface-base">
            <input type="checkbox" className="size-5 accent-primary" checked={checks[c] ?? false} onChange={(e) => setChecks((prev) => ({ ...prev, [c]: e.target.checked }))} />
            <span>{t(`check.${c as "no_warping"}`)}</span>
          </label>
        ))}
      </fieldset>

      <Field label={t("notes")}>{({ id }) => <Textarea id={id} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>

      <Button size="xl" loading={pending} disabled={upload !== null} onClick={submit}>
        {t("submitEvidence")}
      </Button>
    </Card>
  );
}
