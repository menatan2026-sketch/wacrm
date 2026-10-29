"use client";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface RadioCardOption<V extends string> {
  value: V;
  title: string;
  description?: string;
  icon?: ReactNode;
  aside?: ReactNode;
}

/**
 * Large choice cards (the preferred control in the customer wizard). Native radios underneath,
 * so keyboard and screen readers behave exactly like a radio group.
 */
export function RadioCards<V extends string>({
  name,
  legend,
  legendHint,
  options,
  value,
  onChange,
  columns = 1,
}: {
  name: string;
  legend: string;
  legendHint?: string;
  options: RadioCardOption<V>[];
  value: V | undefined;
  onChange: (value: V) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-base font-semibold text-text-primary">{legend}</legend>
      {legendHint && <p className="-mt-1 text-sm text-text-secondary">{legendHint}</p>}
      <div className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3 rounded-m border bg-surface-raised p-4 transition-[border-color,box-shadow,transform] duration-(--mfg-duration-fast)",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus active:scale-[0.99]",
                selected ? "border-primary shadow-floating ring-1 ring-primary" : "border-border-default hover:border-border-strong",
              )}
            >
              <input type="radio" name={name} value={o.value} checked={selected} onChange={() => onChange(o.value)} className="sr-only" />
              {o.icon && <span className={cn("mt-0.5 shrink-0", selected ? "text-primary" : "text-text-secondary")}>{o.icon}</span>}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-text-primary">{o.title}</span>
                {o.description && <span className="text-sm text-text-secondary">{o.description}</span>}
              </span>
              {o.aside}
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  selected ? "border-primary bg-primary text-on-primary" : "border-border-strong",
                )}
              >
                {selected && <Check className="size-3.5" strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
