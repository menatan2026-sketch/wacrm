import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-m border border-border-subtle bg-surface-raised p-4 shadow-raised sm:p-6",
        className,
      )}
      {...rest}
    />
  );
}

/** Technical panel: measurements and machine data on a faint coordinate grid. */
export function TechPanel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "tech-grid rounded-m border border-border-strong/40 bg-surface-sunken p-4",
        className,
      )}
      {...rest}
    />
  );
}

export function SectionTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-[1.375rem] leading-[1.3] font-semibold text-text-primary", className)}
      {...rest}
    />
  );
}
