"use client";
import { UploadCloud } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * File drop target. Drag-over draws the dashed "toolpath" outline. The native input stays the
 * accessible control; `capture` enables the phone camera for photo flows.
 */
export function Dropzone({
  accept,
  multiple,
  capture,
  title,
  hint,
  buttonLabel,
  onFiles,
  disabled,
  icon,
}: {
  accept: string;
  multiple?: boolean;
  capture?: boolean;
  title: string;
  hint: string;
  buttonLabel: string;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "tech-grid relative flex flex-col items-center gap-3 rounded-l border-2 border-dashed px-6 py-10 text-center transition-colors duration-(--mfg-duration-fast)",
        over ? "toolpath-active border-primary bg-primary-subtle" : "border-border-default bg-surface-raised",
        disabled && "opacity-60",
      )}
    >
      <span className="text-primary">{icon ?? <UploadCloud aria-hidden className="size-10" strokeWidth={1.5} />}</span>
      <p className="text-base font-semibold text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary">{hint}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="mt-1 inline-flex h-12 items-center rounded-s bg-primary px-5 font-medium text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
      >
        {buttonLabel}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        capture={capture ? "environment" : undefined}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
}
