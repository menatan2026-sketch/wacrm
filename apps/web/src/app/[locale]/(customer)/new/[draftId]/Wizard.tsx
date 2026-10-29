"use client";
import dynamic from "next/dynamic";
import {
  Box,
  Camera,
  Car,
  CheckCircle2,
  Droplets,
  Home,
  Plus,
  Ruler,
  Sun,
  Thermometer,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { formatMoney, formatNumber, formatPercent, parseDecimal } from "@mfg/i18n/format";
import { StepTransition, ValueSwap } from "@mfg/motion";
import {
  Badge,
  Banner,
  Button,
  Card,
  Dropzone,
  Field,
  Input,
  Ltr,
  MeasurementInput,
  Progress,
  RadioCards,
  StagedProgress,
  Stepper,
  Textarea,
  TechPanel,
  type StageItem,
} from "@mfg/ui";
import {
  completeUploadAction,
  createUploadAction,
  evaluateDraftAction,
  saveDraftAction,
  submitDraftAction,
} from "@/app/actions/wizard";
import { useErrorMessage } from "@/lib/errors";
import { putWithProgress } from "@/lib/upload";
import type { WizardView } from "@/lib/wizard-view";

const ModelViewer = dynamic(() => import("@mfg/ui/viewer").then((m) => m.ModelViewer), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] animate-pulse rounded-m bg-viewer-canvas" />,
});

type Flow = "file" | "object" | "idea";
type Payload = {
  fileId?: string;
  units?: "mm" | "in";
  scale?: number;
  usage?: Record<string, string | boolean | undefined>;
  materialVariantId?: string;
  quantity?: number;
  urgency?: "standard" | "fast" | "urgent";
  description?: string;
  photoFileIds?: string[];
  dimensions?: { name: string; valueMm: number }[];
  referenceObject?: string;
};

const ANALYSIS_STAGES = ["parse", "measure", "check_geometry", "printability", "volume"] as const;
const QUESTIONS = [
  {
    key: "environment",
    options: ["indoor", "outdoor", "car", "wet"],
    icons: { indoor: Home, outdoor: Sun, car: Car, wet: Droplets },
  },
  {
    key: "heat",
    options: ["none", "warm", "hot", "very_hot"],
    icons: { hot: Thermometer, very_hot: Thermometer },
  },
  { key: "load", options: ["none", "light", "moderate", "heavy"] },
  { key: "flexibility", options: ["rigid", "slight", "rubber"] },
  { key: "appearance", options: ["functional", "clean", "showpiece"] },
] as const;

function addBusinessDays(days: number) {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 5 && d.getDay() !== 6) added++;
  }
  return d;
}

export function Wizard({
  draft,
  steps,
  initialView,
  signedIn,
  maxModelMb,
}: {
  draft: { id: string; flow: Flow; step: string; payload: Record<string, unknown> };
  steps: string[];
  initialView: WizardView;
  signedIn: boolean;
  maxModelMb: number;
}) {
  const t = useTranslations("customer.wizard");
  const tm = useTranslations("manufacturing");
  const tq = useTranslations("quotes");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const locale = useLocale() as "he" | "en" | "ru";
  const dir = locale === "he" ? "rtl" : "ltr";
  const errorText = useErrorMessage();

  const [payload, setPayload] = useState<Payload>(draft.payload as Payload);
  const [stepIndex, setStepIndex] = useState(Math.max(0, steps.indexOf(draft.step)));
  const [direction, setDirection] = useState<1 | -1>(1);
  const [view, setView] = useState(initialView);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [analysisSlow, setAnalysisSlow] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [dimRows, setDimRows] = useState<{ name: string; raw: string }[]>(() =>
    payload.dimensions?.length
      ? payload.dimensions.map((d) => ({ name: d.name, raw: String(d.valueMm) }))
      : [{ name: "", raw: "" }],
  );
  const step = steps[stepIndex]!;

  const refresh = useCallback(async () => {
    const r = await evaluateDraftAction(draft.id, locale);
    if (r.ok) setView(r.data);
    return r.ok ? r.data : null;
  }, [draft.id, locale]);

  // Poll only while the geometry service is genuinely working on the file.
  const analyzing =
    view.analysis && (view.analysis.status === "queued" || view.analysis.status === "running");
  useEffect(() => {
    if (!analyzing) return;
    // A dropped connection just means this tick is skipped; the next one retries.
    const id = setInterval(() => refresh().catch(() => undefined), 1500);
    // After 10 s, say that big files take longer (never fake progress).
    const slow = setTimeout(() => setAnalysisSlow(true), 10_000);
    return () => {
      clearInterval(id);
      clearTimeout(slow);
    };
  }, [analyzing, refresh]);

  const save = useCallback(
    async (patch: Payload, nextStep?: string) => {
      setPayload((p) => ({ ...p, ...patch, usage: { ...p.usage, ...patch.usage } }));
      const r = await saveDraftAction(draft.id, nextStep, patch);
      if (!r.ok) setError(errorText(r));
      return r.ok;
    },
    [draft.id, errorText],
  );

  const go = (delta: 1 | -1, patch: Payload = {}) =>
    start(async () => {
      setError(undefined);
      const next = steps[stepIndex + delta];
      if (!next) return;
      if (await save(patch, next)) {
        setDirection(delta);
        setStepIndex(stepIndex + delta);
        if (next === "price" || next === "review" || next === "size") await refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

  const uploadFiles = async (list: File[], kind: "model" | "photo") => {
    setError(undefined);
    const ids: string[] = [];
    for (const file of list) {
      if (kind === "model" && /\.(step|stp)$/i.test(file.name)) {
        setError(t("upload.noStep"));
        return [];
      }
      const session = await createUploadAction({ fileName: file.name, size: file.size, kind });
      if (!session.ok) {
        setError(errorText(session));
        return ids;
      }
      setUploadProgress(0);
      try {
        await putWithProgress(
          session.data.upload.url,
          session.data.upload.headers,
          file,
          setUploadProgress,
        );
      } catch {
        setUploadProgress(null);
        setError(errorText({ code: "files.size_mismatch" }));
        return ids;
      }
      const done = await completeUploadAction(session.data.fileId);
      setUploadProgress(null);
      if (!done.ok) {
        setError(errorText(done));
        return ids;
      }
      ids.push(session.data.fileId);
    }
    return ids;
  };

  const usage = payload.usage ?? {};
  const usageComplete =
    QUESTIONS.every((q) => usage[q.key] !== undefined) && usage.foodContact !== undefined;
  const units = payload.units ?? (view.analysis?.unitsDetected === "in" ? "in" : "mm");
  const scale = payload.scale ?? 1;
  const dims =
    view.analysis?.rawBboxMm?.map((v) => v * (units === "in" ? 25.4 : 1) * scale) ?? null;
  const dimsText = dims
    ? tc("dimensions", {
        x: formatNumber(dims[0]!, locale, 1),
        y: formatNumber(dims[1]!, locale, 1),
        z: formatNumber(dims[2]!, locale, 1),
        unit: tc("units.mm"),
      })
    : "";

  const analysisStages: StageItem[] = useMemo(() => {
    const a = view.analysis;
    const items: StageItem[] = [
      {
        key: "upload",
        label: t("analysis.stages.upload"),
        state: a ? "done" : uploadProgress !== null ? "active" : "pending",
      },
    ];
    let activeAssigned = false;
    for (const s of ANALYSIS_STAGES) {
      const reported = a?.stages.find((x) => x.stage === s);
      let state: StageItem["state"] = reported
        ? reported.status === "failed"
          ? "failed"
          : "done"
        : "pending";
      if (!reported && a && (a.status === "queued" || a.status === "running") && !activeAssigned) {
        state = "active";
        activeAssigned = true;
      }
      items.push({
        key: s,
        label: t(`analysis.stages.${s}`),
        state,
        detail: s === "measure" && reported?.status === "done" ? dimsText : undefined,
      });
    }
    return items;
  }, [view.analysis, uploadProgress, t, dimsText]);

  const selectedVariant = payload.materialVariantId ?? view.selectedVariantId ?? undefined;
  const selectedMaterial =
    view.materials.find((m) => m.variants.some((v) => v.id === selectedVariant)) ??
    view.materials[0];
  const needsReview = view.reviewReasons.length > 0;

  const reviewReasonText = (r: string) => {
    if (r.startsWith("geometry_")) return tm("review.geometry");
    if (r.startsWith("flow_")) return tm("review.flow");
    return tm.has(`review.${r}`) ? tm(`review.${r}`) : tm("review.other");
  };

  const priceChange = (patch: Payload) =>
    start(async () => {
      await save(patch);
      await refresh();
    });

  const submit = () =>
    start(async () => {
      setError(undefined);
      if (draft.flow !== "file") {
        const parsed = dimRows
          .filter((d) => d.name.trim() || d.raw.trim())
          .map((d) => ({ name: d.name.trim(), valueMm: parseDecimal(d.raw) ?? NaN }));
        if (parsed.some((d) => !d.name || !(d.valueMm > 0))) return setError(tv("number"));
        if (!(await save({ dimensions: parsed }))) return;
      }
      const r = await submitDraftAction(draft.id, locale);
      if (r && !r.ok) setError(errorText(r));
    });

  return (
    <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-8 md:px-8 lg:grid-cols-12">
      <div className="flex flex-col gap-6 lg:col-span-7">
        <Stepper
          steps={steps.map((s) => t(`steps.${s}`))}
          current={stepIndex}
          ofLabel={t("stepOf", {
            current: stepIndex + 1,
            total: steps.length,
            name: t(`steps.${step}`),
          })}
        />
        {error && <Banner tone="danger">{error}</Banner>}
        <StepTransition stepKey={step} direction={direction} dir={dir}>
          <section aria-labelledby="step-title" className="flex flex-col gap-6">
            {step === "upload" && (
              <>
                <h1 id="step-title" className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold">
                  {t("upload.title")}
                </h1>
                {!payload.fileId || uploadProgress !== null ? (
                  <Dropzone
                    accept=".stl,.3mf"
                    title={t("upload.drop")}
                    hint={t("upload.hint", { max: `${maxModelMb} MB` })}
                    buttonLabel={t("upload.choose")}
                    disabled={uploadProgress !== null}
                    onFiles={(list) =>
                      start(async () => {
                        const [fileId] = await uploadFiles(list.slice(0, 1), "model");
                        if (fileId) {
                          await save({ fileId, units: undefined, scale: 1 });
                          setAnalysisSlow(false);
                          await refresh();
                        }
                      })
                    }
                  />
                ) : null}
                {uploadProgress !== null && (
                  <Progress
                    value={uploadProgress}
                    label={t("upload.uploading", { pct: Math.round(uploadProgress * 100) })}
                  />
                )}
                {(payload.fileId || uploadProgress !== null) && (
                  <Card className="flex flex-col gap-4">
                    <h2 className="font-semibold">{t("analysis.title")}</h2>
                    <StagedProgress label={t("analysis.title")} stages={analysisStages} />
                    {analyzing && analysisSlow && (
                      <p className="text-sm text-text-secondary">{t("analysis.slow")}</p>
                    )}
                    {view.analysis?.status === "succeeded" && (
                      <p className="font-medium text-success">
                        {t("analysis.done", { dims: dimsText })}
                      </p>
                    )}
                    {view.analysis?.status === "failed" && (
                      <Banner tone="warning" title={t("analysis.failed.title")}>
                        {t.has(`analysis.failed.${view.analysis.failureCode}`)
                          ? t(`analysis.failed.${view.analysis.failureCode}`)
                          : t("analysis.failed.other")}
                      </Banner>
                    )}
                    {payload.fileId && !analyzing && (
                      <button
                        type="button"
                        className="self-start text-sm text-primary hover:underline"
                        onClick={() => setPayload((p) => ({ ...p, fileId: undefined }))}
                      >
                        {t("upload.replace")}
                      </button>
                    )}
                  </Card>
                )}
              </>
            )}

            {step === "describe" && (
              <>
                <h1 id="step-title" className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold">
                  {draft.flow === "object" ? t("describe.titleObject") : t("describe.titleIdea")}
                </h1>
                <Field
                  label={t("describe.description")}
                  hint={
                    draft.flow === "object"
                      ? t("describe.descriptionHintObject")
                      : t("describe.descriptionHintIdea")
                  }
                >
                  {({ id, describedBy }) => (
                    <Textarea
                      id={id}
                      aria-describedby={describedBy}
                      value={payload.description ?? ""}
                      onChange={(e) => setPayload((p) => ({ ...p, description: e.target.value }))}
                    />
                  )}
                </Field>
                <div className="flex flex-col gap-3">
                  <h2 className="font-semibold">{t("describe.photos")}</h2>
                  <p className="text-sm text-text-secondary">{t("describe.photosHint")}</p>
                  <Dropzone
                    accept="image/*"
                    multiple
                    capture
                    icon={<Camera aria-hidden className="size-10" strokeWidth={1.5} />}
                    title={t("describe.addPhotos")}
                    hint={t("describe.photosHint")}
                    buttonLabel={t("describe.takePhoto")}
                    disabled={uploadProgress !== null}
                    onFiles={(list) =>
                      start(async () => {
                        const ids = await uploadFiles(list.slice(0, 20), "photo");
                        if (ids.length)
                          await save({ photoFileIds: [...(payload.photoFileIds ?? []), ...ids] });
                      })
                    }
                  />
                  {uploadProgress !== null && (
                    <Progress
                      value={uploadProgress}
                      label={t("upload.uploading", { pct: Math.round(uploadProgress * 100) })}
                    />
                  )}
                  {payload.photoFileIds?.length ? (
                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {payload.photoFileIds.map((id) => (
                        <li
                          key={id}
                          className="relative aspect-square overflow-hidden rounded-s border border-border-subtle"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- private, authorized image route */}
                          <img src={`/api/files/${id}`} alt="" className="size-full object-cover" />
                          <button
                            type="button"
                            aria-label={tc("actions.remove")}
                            className="absolute end-1 top-1 rounded-full bg-surface-raised/90 p-1"
                            onClick={() =>
                              start(
                                async () =>
                                  void (await save({
                                    photoFileIds: payload.photoFileIds!.filter((x) => x !== id),
                                  })),
                              )
                            }
                          >
                            <Trash2 aria-hidden className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {draft.flow === "object" && (
                  <Field label={t("describe.reference")}>
                    {({ id }) => (
                      <Input
                        id={id}
                        value={payload.referenceObject ?? ""}
                        onChange={(e) =>
                          setPayload((p) => ({ ...p, referenceObject: e.target.value }))
                        }
                      />
                    )}
                  </Field>
                )}
              </>
            )}

            {step === "usage" && (
              <>
                <div className="flex flex-col gap-2">
                  <h1 id="step-title" className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold">
                    {t("usage.title")}
                  </h1>
                  <p className="text-text-secondary">{t("usage.intro")}</p>
                </div>
                {QUESTIONS.map((q) => (
                  <RadioCards
                    key={q.key}
                    name={q.key}
                    legend={tm(`usage.${q.key}.q`)}
                    legendHint={tm(`usage.${q.key}.why`)}
                    columns={q.options.length > 3 ? 2 : 3}
                    value={usage[q.key] as string | undefined}
                    onChange={(value) => void save({ usage: { [q.key]: value } })}
                    options={q.options.map((o) => {
                      const Icon = (q as { icons?: Record<string, typeof Home> }).icons?.[o];
                      return {
                        value: o,
                        title: tm(`usage.${q.key}.${o}`),
                        icon: Icon ? <Icon aria-hidden className="size-5" /> : undefined,
                      };
                    })}
                  />
                ))}
                <RadioCards
                  name="foodContact"
                  legend={tm("usage.food.q")}
                  legendHint={tm("usage.food.why")}
                  columns={2}
                  value={
                    usage.foodContact === undefined ? undefined : usage.foodContact ? "yes" : "no"
                  }
                  onChange={(v) => void save({ usage: { foodContact: v === "yes" } })}
                  options={[
                    { value: "no", title: tm("usage.food.no") },
                    { value: "yes", title: tm("usage.food.yes") },
                  ]}
                />
                <Field label={tm("usage.critical")} hint={tm("usage.criticalHint")}>
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      value={(usage.criticalDimensions as string) ?? ""}
                      onChange={(e) =>
                        setPayload((p) => ({
                          ...p,
                          usage: { ...p.usage, criticalDimensions: e.target.value },
                        }))
                      }
                    />
                  )}
                </Field>
              </>
            )}

            {step === "size" && draft.flow === "file" && (
              <>
                <div className="flex flex-col gap-2">
                  <h1 id="step-title" className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold">
                    {t("size.title")}
                  </h1>
                  <p className="text-text-secondary">{t("size.intro")}</p>
                </div>
                {view.analysis?.rawBboxMm ? (
                  <>
                    <RadioCards
                      name="units"
                      legend={t("size.units")}
                      legendHint={
                        view.analysis.unitsDetected === "unknown" ? t("size.unitsHint") : undefined
                      }
                      columns={2}
                      value={units}
                      onChange={(u) => void save({ units: u })}
                      options={[
                        {
                          value: "mm",
                          title: tc("units.mm"),
                          icon: <Ruler aria-hidden className="size-5" />,
                        },
                        {
                          value: "in",
                          title: tc("units.in"),
                          icon: <Ruler aria-hidden className="size-5" />,
                        },
                      ]}
                    />
                    <MeasurementInput
                      label={t("size.scale")}
                      hint={t("size.scaleHint")}
                      unitLabel="%"
                      value={String(Math.round(scale * 100))}
                      onChange={(raw) => {
                        const v = parseDecimal(raw);
                        if (v && v >= 10 && v <= 1000) void save({ scale: v / 100 });
                      }}
                    />
                    <TechPanel className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-text-secondary">
                        {t("size.result")}
                      </span>
                      <span className="text-2xl font-medium">
                        <Ltr mono>{dimsText}</Ltr>
                      </span>
                    </TechPanel>
                  </>
                ) : (
                  <Banner tone="info">{t("analysis.failed.continue")}</Banner>
                )}
              </>
            )}

            {step === "size" && draft.flow !== "file" && (
              <>
                <div className="flex flex-col gap-2">
                  <h1 id="step-title" className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold">
                    {t("dimensions.title")}
                  </h1>
                  <p className="text-text-secondary">{t("dimensions.intro")}</p>
                </div>
                {dimRows.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_9rem_auto] items-end gap-3">
                    <Field label={t("dimensions.name")}>
                      {({ id }) => (
                        <Input
                          id={id}
                          placeholder={t("dimensions.namePlaceholder")}
                          value={row.name}
                          onChange={(e) =>
                            setDimRows((r) =>
                              r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                            )
                          }
                        />
                      )}
                    </Field>
                    <MeasurementInput
                      label={t("dimensions.value")}
                      unitLabel={tc("units.mm")}
                      value={row.raw}
                      onChange={(raw) =>
                        setDimRows((r) => r.map((x, j) => (j === i ? { ...x, raw } : x)))
                      }
                    />
                    <Button
                      variant="ghost"
                      aria-label={tc("actions.remove")}
                      onClick={() =>
                        setDimRows((r) =>
                          r.length > 1 ? r.filter((_, j) => j !== i) : [{ name: "", raw: "" }],
                        )
                      }
                    >
                      <Trash2 aria-hidden className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  icon={<Plus aria-hidden className="size-4" />}
                  onClick={() => setDimRows((r) => [...r, { name: "", raw: "" }])}
                  className="self-start"
                >
                  {t("dimensions.add")}
                </Button>
              </>
            )}

            {step === "review" && (
              <>
                <h1 id="step-title" className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold">
                  {t("review.title")}
                </h1>
                {view.analysis?.previewFileId ? (
                  showViewer ? (
                    <ModelViewer
                      url={`/api/files/${view.analysis.previewFileId}`}
                      label={t("review.viewerLabel", { dims: dimsText })}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowViewer(true)}
                      className="tech-grid flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-m border border-border-default bg-viewer-canvas text-text-inverse focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      <Box aria-hidden className="size-12 text-primary" strokeWidth={1.25} />
                      <span className="font-medium text-viewer-text">
                        {t("review.loadPreview")}
                      </span>
                    </button>
                  )
                ) : (
                  <Banner tone="info">{t("review.noPreview")}</Banner>
                )}
                <TechPanel>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-text-secondary">{t("review.dims")}</dt>
                      <dd className="text-lg font-medium">
                        <Ltr mono>{dimsText || "—"}</Ltr>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-secondary">{t("review.checks")}</dt>
                      <dd className="flex flex-col gap-1 text-sm">
                        {view.analysis?.warnings.length ? (
                          view.analysis.warnings.map((w) => (
                            <span key={w}>
                              {t.has(`analysis.warnings.${w}`) ? t(`analysis.warnings.${w}`) : w}
                            </span>
                          ))
                        ) : (
                          <span className="text-success">{t("review.allGood")}</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </TechPanel>
              </>
            )}

            {step === "price" && (
              <>
                <h1 id="step-title" className="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold">
                  {t("price.title")}
                </h1>
                {needsReview && (
                  <Banner tone="info" title={t("price.review")}>
                    <p>{t("price.reviewBody")}</p>
                    <ul className="mt-2 list-disc ps-5">
                      {view.reviewReasons.map((r) => (
                        <li key={r}>{reviewReasonText(r)}</li>
                      ))}
                    </ul>
                  </Banner>
                )}
                {view.materials.length > 0 && (
                  <RadioCards
                    name="material"
                    legend={t("price.material")}
                    value={selectedMaterial?.id}
                    onChange={(materialId) =>
                      priceChange({
                        materialVariantId: view.materials.find((m) => m.id === materialId)!
                          .variants[0]!.id,
                      })
                    }
                    options={view.materials.map((m) => ({
                      value: m.id,
                      title: m.name,
                      description: m.description,
                      aside: m.recommended ? (
                        <Badge tone="success">{t("price.recommended")}</Badge>
                      ) : undefined,
                    }))}
                  />
                )}
                {selectedMaterial && selectedMaterial.variants.length > 1 && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 font-semibold">{t("price.color")}</legend>
                    <div className="flex flex-wrap gap-2">
                      {selectedMaterial.variants.map((v) => (
                        <label
                          key={v.id}
                          className="flex cursor-pointer items-center gap-2 rounded-full border border-border-default px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus"
                        >
                          <input
                            type="radio"
                            name="color"
                            className="sr-only"
                            checked={selectedVariant === v.id}
                            onChange={() => priceChange({ materialVariantId: v.id })}
                          />
                          <span
                            aria-hidden
                            className="size-4 rounded-full border border-border-strong"
                            style={{ background: v.hex }}
                          />
                          {v.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <div className="flex flex-wrap items-end gap-4">
                  <Field label={t("price.quantity")} className="w-32">
                    {({ id }) => (
                      <Input
                        id={id}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={500}
                        dir="ltr"
                        defaultValue={payload.quantity ?? 1}
                        onBlur={(e) => {
                          const q = Math.round(Number(e.target.value));
                          if (q >= 1 && q <= 500 && q !== (payload.quantity ?? 1))
                            priceChange({ quantity: q });
                        }}
                      />
                    )}
                  </Field>
                </div>
                <RadioCards
                  name="urgency"
                  legend={t("price.urgency")}
                  columns={3}
                  value={payload.urgency ?? "standard"}
                  onChange={(u) => priceChange({ urgency: u })}
                  options={(["standard", "fast", "urgent"] as const).map((u) => ({
                    value: u,
                    title: tm(`urgency.${u}`),
                    description: tm(`urgency.${u}Hint`),
                  }))}
                />
              </>
            )}

            {step === "submit" && (
              <Card className="flex flex-col gap-3">
                <h1 id="step-title" className="text-2xl font-semibold">
                  {t("submit.title")}
                </h1>
                <p className="text-text-secondary">{t("submit.body")}</p>
              </Card>
            )}
          </section>
        </StepTransition>

        <div className="sticky bottom-0 -mx-4 flex gap-3 border-t border-border-subtle bg-surface-base/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
          {stepIndex > 0 && (
            <Button variant="secondary" size="lg" disabled={pending} onClick={() => go(-1)}>
              {tc("actions.back")}
            </Button>
          )}
          {step === "price" || step === "submit" ? (
            <Button size="lg" className="flex-1 md:flex-none" loading={pending} onClick={submit}>
              {step === "submit"
                ? t("submit.send")
                : needsReview
                  ? t("price.send")
                  : t("price.continue")}
            </Button>
          ) : (
            <Button
              size="lg"
              className="flex-1 md:flex-none"
              loading={pending}
              disabled={
                (step === "upload" && (!payload.fileId || Boolean(analyzing))) ||
                (step === "usage" && !usageComplete) ||
                (step === "describe" && (payload.description ?? "").trim().length < 10)
              }
              onClick={() =>
                go(
                  1,
                  step === "usage"
                    ? {
                        usage: {
                          criticalDimensions: usage.criticalDimensions as string | undefined,
                        },
                      }
                    : step === "describe"
                      ? {
                          description: payload.description,
                          referenceObject: payload.referenceObject,
                        }
                      : {},
                )
              }
            >
              {tc("actions.continue")}
            </Button>
          )}
        </div>
        {(step === "price" || step === "submit") && !signedIn && (
          <p className="text-sm text-text-secondary">{t("price.signInToContinue")}</p>
        )}
      </div>

      <aside className="lg:col-span-5">
        <div className="sticky top-24 flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <h2 className="font-semibold">{t("price.breakdown")}</h2>
            {view.price ? (
              <>
                <dl className="flex flex-col gap-2 text-sm">
                  {view.price.lines.map((l) => (
                    <div key={l.labelKey} className="flex justify-between gap-4">
                      <dt className="text-text-secondary">
                        {tq(l.labelKey.replace("quotes.", "") as "lines.manufacturing")}
                      </dt>
                      <dd className="tabular-nums">
                        {formatMoney(l.amountNetMinor, view.price!.currency, locale)}
                      </dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 border-t border-border-subtle pt-2">
                    <dt className="text-text-secondary">
                      {tq("vat", { rate: formatPercent(view.price.taxRateBps / 10000, locale) })}
                    </dt>
                    <dd className="tabular-nums">
                      {formatMoney(view.price.taxMinor, view.price.currency, locale)}
                    </dd>
                  </div>
                </dl>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">{t("price.total")}</span>
                  <span className="text-3xl font-medium tabular-nums">
                    <ValueSwap value={String(view.price.totalMinor)}>
                      {formatMoney(view.price.totalMinor, view.price.currency, locale)}
                    </ValueSwap>
                  </span>
                </div>
                <p className="text-sm text-text-secondary">
                  {t("price.shipBy", {
                    date: new Intl.DateTimeFormat(locale === "he" ? "he-IL" : locale, {
                      dateStyle: "medium",
                    }).format(addBusinessDays(view.price.leadDays)),
                  })}
                </p>
                <p className="text-xs text-text-tertiary">{t("price.estimate")}</p>
              </>
            ) : (
              <p className="text-sm text-text-secondary">
                {needsReview ? t("price.reviewBody") : "—"}
              </p>
            )}
          </Card>
          {view.rationale.length > 0 && selectedMaterial && (
            <Card className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{t("price.why")}</h2>
              <ul className="flex flex-col gap-1 text-sm text-text-secondary">
                {view.rationale.map((r) => (
                  <li key={r} className="flex gap-2">
                    <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                    {tm.has(`reasons.${r}`) ? tm(`reasons.${r}`) : tm("reasons.default")}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </aside>
    </div>
  );
}
