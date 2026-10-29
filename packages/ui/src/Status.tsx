import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  Info,
  Layers,
  XOctagon,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "./cn";

export type Tone = "neutral" | "info" | "primary" | "signature" | "success" | "warning" | "danger";

const TONES: Record<
  Tone,
  { cls: string; Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }> }
> = {
  neutral: {
    cls: "bg-surface-sunken text-text-secondary border-border-default",
    Icon: CircleDashed,
  },
  info: { cls: "bg-info-subtle text-info border-info/30", Icon: Info },
  primary: { cls: "bg-primary-subtle text-primary border-primary/30", Icon: Clock },
  signature: { cls: "bg-signature-subtle text-signature border-signature/40", Icon: Layers },
  success: { cls: "bg-success-subtle text-success border-success/30", Icon: CheckCircle2 },
  warning: { cls: "bg-warning-subtle text-warning border-warning/30", Icon: AlertTriangle },
  danger: { cls: "bg-danger-subtle text-danger border-danger/30", Icon: XOctagon },
};

/** Order status → tone (UI_DESIGN_SYSTEM §5.4). */
export const ORDER_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  REQUIREMENTS_PENDING: "neutral",
  REVIEW_REQUIRED: "info",
  DESIGN_REQUIRED: "info",
  DESIGN_IN_PROGRESS: "info",
  DESIGN_APPROVAL: "primary",
  QUOTE_READY: "primary",
  PAYMENT_PENDING: "primary",
  PAID: "info",
  ROUTING: "info",
  SUPPLIER_ASSIGNED: "info",
  SUPPLIER_ACCEPTED: "info",
  PRODUCTION: "signature",
  QC_PENDING: "info",
  QC_FAILED: "warning",
  REPRINT_REQUIRED: "warning",
  READY_FOR_SHIPMENT: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  DISPUTED: "danger",
};

export const JOB_TONE: Record<string, Tone> = {
  OFFERED: "info",
  ACCEPTED: "info",
  IN_PRODUCTION: "signature",
  QC_PENDING: "info",
  QC_PASSED: "success",
  QC_FAILED: "danger",
  HANDED_OFF: "success",
  CANCELLED: "neutral",
};

/** Status = icon + label + color + tooltip. Never color alone. */
export function StatusChip({
  tone,
  label,
  description,
  size = "md",
}: {
  tone: Tone;
  label: string;
  description?: string;
  size?: "sm" | "md";
}) {
  const { cls, Icon } = TONES[tone];
  return (
    <span
      title={description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        cls,
      )}
    >
      <Icon aria-hidden className={size === "sm" ? "size-3.5" : "size-4"} />
      {label}
    </span>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs border px-1.5 py-0.5 text-xs font-medium",
        TONES[tone].cls,
      )}
    >
      {children}
    </span>
  );
}

export const OnHoldIcon = Ban;
