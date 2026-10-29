import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "danger" | "danger-outline";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-surface-raised text-text-primary border border-border-default hover:border-border-strong",
  tertiary: "bg-transparent text-primary underline-offset-4 hover:underline",
  ghost: "bg-transparent text-text-primary hover:bg-surface-sunken",
  danger: "bg-danger text-on-primary hover:opacity-90",
  "danger-outline": "bg-surface-raised text-danger border border-danger hover:bg-danger-subtle",
};
const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
  xl: "h-14 px-6 text-base gap-2.5 w-full sm:w-auto",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

/** Verb-labelled action. Loading keeps the label, locks width and blocks repeat clicks. */
export function Button({ variant = "primary", size = "md", loading = false, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded-s font-medium",
        "transition-[background-color,border-color,transform,opacity] duration-(--mfg-duration-micro) ease-(--mfg-ease-standard)",
        "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : icon}
      {children}
    </button>
  );
}

/** Link styled as a button (navigation, not actions). */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-s font-medium transition-[background-color,border-color] duration-(--mfg-duration-micro)",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}
