import { DESTINATION } from "@/data/markets";
import { landPoints } from "@/lib/geo";

/**
 * A quiet route map from an origin city to Israel, drawn from the same
 * land data as the globe. Used where client photography will later go.
 */
export function RouteArt({
  from,
  label,
  destinationLabel,
  className,
}: {
  from: { lat: number; lng: number };
  label: string;
  destinationLabel: string;
  className?: string;
}) {
  const W = 800;
  const H = 500;
  const pad = 14;
  const lat0 = Math.min(from.lat, DESTINATION.lat);
  const lat1 = Math.max(from.lat, DESTINATION.lat);
  const lng0 = Math.min(from.lng, DESTINATION.lng);
  const lng1 = Math.max(from.lng, DESTINATION.lng);
  // Frame the route with generous margins, preserving aspect.
  const spanLng = Math.max(lng1 - lng0, 20) * 1.5;
  const spanLat = Math.max(spanLng * (H / W), (lat1 - lat0) * 1.6);
  const cLng = (lng0 + lng1) / 2;
  const cLat = (lat0 + lat1) / 2;
  const proj = (lat: number, lng: number): [number, number] => [
    ((lng - (cLng - spanLng / 2)) / spanLng) * W,
    H - ((lat - (cLat - spanLat / 2)) / spanLat) * H,
  ];
  const dots = landPoints()
    .map(([la, ln]) => proj(la, ln))
    .filter(([x, y]) => x > pad && x < W - pad && y > pad && y < H - pad);
  const [ax, ay] = proj(from.lat, from.lng);
  const [bx, by] = proj(DESTINATION.lat, DESTINATION.lng);
  const mx = (ax + bx) / 2;
  const my = Math.min(ay, by) - Math.hypot(bx - ax, by - ay) * 0.28;
  const path = `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}`;

  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Route from ${label} to ${destinationLabel}`}>
      <rect width={W} height={H} fill="#07070a" />
      <g fill="#8a93a6" opacity="0.32">
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="1.6" />
        ))}
      </g>
      <path d={path} fill="none" stroke="#d9bb92" strokeWidth="1.4" strokeDasharray="3 5" opacity="0.9" />
      <circle cx={ax} cy={ay} r="4" fill="#f1f0ec" />
      <circle cx={bx} cy={by} r="5" fill="#d9bb92" />
      <circle cx={bx} cy={by} r="14" fill="none" stroke="#d9bb92" opacity="0.4" />
      <text x={ax + 12} y={ay - 10} fill="#f1f0ec" fontFamily="var(--font-mono)" fontSize="13" letterSpacing="2">
        {label.toUpperCase()}
      </text>
      <text x={bx + 18} y={by + 4} fill="#d9bb92" fontFamily="var(--font-mono)" fontSize="13" letterSpacing="2">
        {destinationLabel.toUpperCase()}
      </text>
    </svg>
  );
}
