import { Check, Circle, X } from "lucide-react";
import { cn } from "./cn";
import { LayerBuildup } from "./LayerBuildup";

export type StageState = "done" | "active" | "pending" | "failed";

export interface StageItem {
  key: string;
  label: string;
  state: StageState;
  detail?: string;
}

/**
 * Real-state staged progress (MOTION_SYSTEM §3.1): a stage only completes when its event arrived.
 * Announced politely to screen readers; identical information with reduced motion.
 */
export function StagedProgress({ stages, label }: { stages: StageItem[]; label: string }) {
  return (
    <ol aria-label={label} aria-live="polite" className="flex flex-col gap-2.5">
      {stages.map((s) => (
        <li key={s.key} className="flex items-start gap-3">
          <StageIcon state={s.state} />
          <span className="flex flex-col">
            <span
              className={cn(
                "text-sm",
                s.state === "pending" ? "text-text-tertiary" : "font-medium text-text-primary",
                s.state === "failed" && "text-danger",
              )}
            >
              {s.label}
            </span>
            {s.detail && <span className="font-mono text-xs text-text-secondary">{s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StageIcon({ state }: { state: StageState }) {
  const base = "flex size-5 shrink-0 items-center justify-center rounded-full";
  if (state === "done")
    return (
      <span className={cn(base, "stage-done bg-success text-on-primary")}>
        <Check aria-hidden className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (state === "failed")
    return (
      <span className={cn(base, "bg-danger text-on-primary")}>
        <X aria-hidden className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (state === "active")
    return (
      <span className={cn(base, "text-signature")}>
        <LayerBuildup size={18} />
      </span>
    );
  return (
    <span className={cn(base, "text-border-strong")}>
      <Circle aria-hidden className="size-4" />
    </span>
  );
}

export interface TimelineStage {
  key: string;
  label: string;
  state: "done" | "current" | "upcoming" | "exception";
  meta?: string;
}

/** Order timeline: vertical on mobile, horizontal on large screens; mirrors in RTL via logical layout. */
export function Timeline({ stages, label }: { stages: TimelineStage[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-0 lg:flex-row lg:gap-2">
      {stages.map((s, i) => (
        <li
          key={s.key}
          aria-current={s.state === "current" ? "step" : undefined}
          className="relative flex gap-3 pb-5 lg:flex-1 lg:flex-col lg:pb-0"
        >
          {i < stages.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "absolute start-[11px] top-6 h-[calc(100%-1.5rem)] w-px lg:start-6 lg:top-[11px] lg:h-px lg:w-[calc(100%-1.5rem)]",
                s.state === "done" ? "bg-success" : "bg-border-default",
              )}
            />
          )}
          <span
            className={cn(
              "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
              s.state === "done" && "border-success bg-success text-on-primary",
              s.state === "current" && "border-signature bg-surface-raised text-signature",
              s.state === "upcoming" && "border-border-default bg-surface-raised",
              s.state === "exception" && "border-warning bg-surface-raised text-warning",
            )}
          >
            {s.state === "done" ? (
              <Check aria-hidden className="size-3.5" strokeWidth={3} />
            ) : s.state === "current" ? (
              <LayerBuildup size={14} />
            ) : null}
          </span>
          <span className="flex flex-col">
            <span
              className={cn(
                "text-sm",
                s.state === "upcoming" ? "text-text-tertiary" : "font-medium text-text-primary",
              )}
            >
              {s.label}
            </span>
            {s.meta && <span className="text-xs text-text-secondary">{s.meta}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Compact wizard stepper: "Step 3 of 5 · Usage" on mobile; labelled steps on desktop. */
export function Stepper({
  steps,
  current,
  ofLabel,
}: {
  steps: string[];
  current: number;
  ofLabel: string;
}) {
  return (
    <nav aria-label={ofLabel} className="flex flex-col gap-2">
      <p className="text-xs font-medium text-text-secondary sm:hidden">{ofLabel}</p>
      <div className="h-1 overflow-hidden rounded-full bg-surface-sunken sm:hidden">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-(--mfg-duration-standard)"
          style={{ width: `${((current + 1) / steps.length) * 100}%` }}
        />
      </div>
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((s, i) => (
          <li
            key={s}
            aria-current={i === current ? "step" : undefined}
            className="flex items-center gap-2"
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full font-mono text-xs",
                i < current && "bg-success text-on-primary",
                i === current && "bg-primary text-on-primary",
                i > current && "border border-border-default text-text-tertiary",
              )}
            >
              {i < current ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                i === current ? "font-medium text-text-primary" : "text-text-secondary",
              )}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className="mx-1 h-px w-6 bg-border-default" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
