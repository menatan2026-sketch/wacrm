"use client";
import { useId, useState } from "react";
import { cn } from "./cn";

/**
 * Number + unit. The value is LTR inside RTL pages; both "," and "." are accepted as the decimal
 * separator (parsing happens in the caller with @mfg/i18n parseDecimal).
 */
export function MeasurementInput({
  label,
  value,
  onChange,
  unitLabel,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (raw: string) => void;
  unitLabel: string;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      <div
        className={cn(
          "flex h-12 items-stretch overflow-hidden rounded-s border bg-surface-raised sm:h-10",
          error ? "border-danger" : focused ? "border-primary" : "border-border-default",
        )}
      >
        <input
          id={id}
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 font-mono text-base text-text-primary outline-none sm:text-sm"
        />
        <span className="flex items-center border-s border-border-subtle bg-surface-sunken px-3 text-sm text-text-secondary">
          {unitLabel}
        </span>
      </div>
      {error ? (
        <p id={`${id}-e`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-h`} className="text-xs text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
