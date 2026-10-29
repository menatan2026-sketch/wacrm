/**
 * Signature "layer buildup" glyph (MOTION_SYSTEM §3.2): strata stack with a mechanical ease, three
 * loops then rest. Under reduced motion it renders the finished stack statically.
 */
export function LayerBuildup({ size = 20, label }: { size?: number; label?: string }) {
  const layers = [0, 1, 2, 3, 4];
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="layer-buildup">
      {layers.map((i) => (
        <rect key={i} x={3} y={16 - i * 3} width={14} height={2} rx={0.5} fill="currentColor" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </svg>
  );
}
