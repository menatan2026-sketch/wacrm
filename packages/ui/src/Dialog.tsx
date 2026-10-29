"use client";
import { Dialog as Base } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/** Accessible dialog (focus trap, Escape, scroll lock from Base UI). Full-screen sheet on mobile. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Base.Root open={open} onOpenChange={onOpenChange}>
      <Base.Portal>
        <Base.Backdrop className="fixed inset-0 z-40 bg-[rgb(17_20_24/0.48)] transition-opacity duration-(--mfg-duration-standard) data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Base.Popup
          className={cn(
            "fixed z-50 flex flex-col gap-4 bg-surface-raised p-6 shadow-modal",
            "inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-l sm:inset-auto sm:start-1/2 sm:top-1/2 sm:w-[min(560px,calc(100vw-2rem))] sm:-translate-y-1/2 sm:rounded-l sm:[translate:calc(-50%*var(--mfg-motion-inline))_-50%]",
            "transition-[opacity,transform] duration-(--mfg-duration-standard) ease-(--mfg-ease-enter) data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Base.Title className="text-lg font-semibold text-text-primary">{title}</Base.Title>
              {description && (
                <Base.Description className="text-sm text-text-secondary">
                  {description}
                </Base.Description>
              )}
            </div>
            <Base.Close
              aria-label={closeLabel}
              className="rounded-s p-1 text-text-secondary hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
            >
              <X aria-hidden className="size-5" />
            </Base.Close>
          </div>
          {children}
          {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
        </Base.Popup>
      </Base.Portal>
    </Base.Root>
  );
}
