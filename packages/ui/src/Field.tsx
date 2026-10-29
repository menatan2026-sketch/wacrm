"use client";
import { AlertCircle } from "lucide-react";
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./cn";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Label above, hint below, error with icon (never color alone). Wires aria-describedby. */
export function Field({ label, hint, error, children, className }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-danger"
        >
          <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  "w-full rounded-s border bg-surface-raised px-3 text-base text-text-primary placeholder:text-text-tertiary transition-colors duration-(--mfg-duration-micro) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus disabled:opacity-50 sm:text-sm";

export function Input({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        "h-12 sm:h-10",
        invalid ? "border-danger" : "border-border-default hover:border-border-strong",
        className,
      )}
      {...rest}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        "min-h-28 py-2.5",
        invalid ? "border-danger" : "border-border-default hover:border-border-strong",
        className,
      )}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        control,
        "h-12 sm:h-10",
        invalid ? "border-danger" : "border-border-default",
        className,
      )}
      {...rest}
    />
  );
}
