import { site } from "@/config/site";

/**
 * Wordmark: wide-set caps and a compass-rose mark — sixteen rhumb lines
 * converging on a point, as on a portolan chart.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  const lines = Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
      {lines.map((a, i) => (
        <line
          key={i}
          x1={12}
          y1={12}
          x2={12 + Math.cos(a) * (i % 4 === 0 ? 10.5 : i % 2 === 0 ? 7 : 4.5)}
          y2={12 + Math.sin(a) * (i % 4 === 0 ? 10.5 : i % 2 === 0 ? 7 : 4.5)}
          stroke="currentColor"
          strokeWidth={i % 4 === 0 ? 1.1 : 0.7}
          opacity={i % 4 === 0 ? 1 : 0.6}
        />
      ))}
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
      <LogoMark />
      {!compact && (
        <span
          style={{
            fontStretch: "125%",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            lineHeight: 1,
            marginRight: "-0.34em",
          }}
        >
          {site.name}
        </span>
      )}
    </span>
  );
}
