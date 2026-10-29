/** Brand mark: stacked layer lines with the signature "nozzle" accent on the active layer. */
export function BrandMark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
        <rect x="4" y="20" width="20" height="3" rx="1" fill="var(--mfg-text-primary)" />
        <rect
          x="6"
          y="15"
          width="16"
          height="3"
          rx="1"
          fill="var(--mfg-text-primary)"
          opacity="0.8"
        />
        <rect
          x="8"
          y="10"
          width="12"
          height="3"
          rx="1"
          fill="var(--mfg-text-primary)"
          opacity="0.6"
        />
        <rect x="11" y="5" width="6" height="3" rx="1" fill="var(--mfg-signature)" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">{name}</span>
    </span>
  );
}
