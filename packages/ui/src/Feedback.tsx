import { AlertTriangle, CheckCircle2, Info, XOctagon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

const BANNER = {
  info: { cls: "bg-info-subtle border-info/30 text-text-primary", Icon: Info, icon: "text-info" },
  success: {
    cls: "bg-success-subtle border-success/30 text-text-primary",
    Icon: CheckCircle2,
    icon: "text-success",
  },
  warning: {
    cls: "bg-warning-subtle border-warning/30 text-text-primary",
    Icon: AlertTriangle,
    icon: "text-warning",
  },
  danger: {
    cls: "bg-danger-subtle border-danger/30 text-text-primary",
    Icon: XOctagon,
    icon: "text-danger",
  },
} as const;

export function Banner({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: keyof typeof BANNER;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const { cls, Icon, icon } = BANNER[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex flex-wrap items-start gap-3 rounded-m border p-4", cls)}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", icon)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-text-secondary">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="tech-grid flex flex-col items-center gap-3 rounded-m border border-dashed border-border-default px-6 py-12 text-center">
      {icon && <div className="text-text-tertiary">{icon}</div>}
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      {body && <p className="max-w-md text-sm text-text-secondary">{body}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-s bg-surface-sunken motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/** Linear progress bound to a real value (bytes, steps). */
export function Progress({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-(--mfg-duration-fast) ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
