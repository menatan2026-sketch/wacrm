/**
 * Studio plate — the fallback "photograph" for a vehicle without images.
 *
 * A side-profile silhouette per body style, lit like a studio shot in the
 * car's real exterior colour, standing on a reflective floor. Real
 * photography (vehicle.images) always takes precedence; this keeps the
 * inventory looking considered while images are being sourced.
 */
import type { BodyType, Vehicle } from "@/domain/types";

export type SilhouetteId = "supercar" | "coupe" | "sedan" | "suv" | "suv-box" | "pickup";

interface Silhouette {
  body: string;
  glass: string;
  wheels: [number, number][];
  r: number;
  /** Extra details (spare wheel, bed line…) drawn in body colour. */
  extra?: string;
  /** Pillars / shut lines drawn as thin strokes. */
  lines?: string;
}

// Ground line at y=356; drawn nose-right, ~780px long.
const SILHOUETTES: Record<SilhouetteId, Silhouette> = {
  supercar: {
    body: "M118 336 L112 302 C110 270 120 252 152 246 L300 232 C380 205 440 160 540 151 C600 147 640 160 690 196 C740 222 820 236 866 248 C884 254 892 270 892 294 L888 336 L808 336 A70 70 0 1 0 692 336 L320 336 A70 70 0 1 0 204 336 Z",
    glass: "M405 224 C450 190 495 166 543 162 C590 160 622 172 660 204 L646 212 C560 214 480 218 405 224 Z",
    wheels: [
      [262, 297],
      [750, 297],
    ],
    r: 57,
    lines: "M560 164 L548 216 M300 236 L400 228",
  },
  coupe: {
    body: "M112 332 L108 270 C108 250 118 240 140 236 C200 226 270 172 350 142 C400 126 450 122 500 124 C550 126 590 140 630 170 L660 190 C720 200 790 204 830 214 C868 224 890 244 892 272 L888 332 L786 332 A68 68 0 1 0 670 332 L367 332 A68 68 0 1 0 251 332 Z",
    glass: "M352 204 C392 170 440 146 496 144 C548 144 584 160 614 188 L600 198 C520 200 430 203 352 204 Z",
    wheels: [
      [309, 296],
      [728, 296],
    ],
    r: 58,
    extra: "M100 168 L262 160 L264 171 L104 179 Z",
    lines: "M510 146 L500 202 M196 174 L206 230 M150 176 L158 236",
  },
  sedan: {
    body: "M116 336 L110 290 C108 266 116 250 138 244 L230 232 C290 196 360 154 440 144 C520 136 580 140 630 170 C680 200 760 222 850 236 C876 242 890 258 890 284 L886 336 L757 336 A66 66 0 1 0 647 336 L305 336 A66 66 0 1 0 195 336 Z",
    glass: "M280 220 C322 186 380 162 440 158 C510 154 562 162 604 190 L618 204 C500 208 380 214 280 220 Z",
    wheels: [
      [250, 300],
      [702, 300],
    ],
    r: 55,
    lines: "M455 158 L450 214 M300 238 L880 250",
  },
  suv: {
    body: "M114 336 L112 180 C112 150 118 128 132 110 C150 88 170 76 200 72 L560 66 C600 66 626 78 650 102 L700 150 C760 160 830 170 866 182 C884 188 892 204 892 226 L890 336 L769 336 A74 74 0 1 0 647 336 L319 336 A74 74 0 1 0 197 336 Z",
    glass: "M168 154 C176 116 196 96 228 93 L560 87 C590 87 610 97 630 117 L672 158 C500 156 330 155 168 154 Z",
    wheels: [
      [258, 294],
      [708, 294],
    ],
    r: 61,
    lines: "M430 90 L428 156 M600 106 L612 158",
  },
  "suv-box": {
    body: "M114 336 L110 104 C110 64 120 52 150 50 L598 46 C614 46 622 52 628 62 L668 170 L866 180 C884 181 890 190 890 206 L892 332 L775 336 A76 76 0 1 0 651 336 L312 336 A76 76 0 1 0 188 336 Z",
    glass: "M150 70 L592 66 L624 156 L150 160 Z",
    wheels: [
      [250, 292],
      [713, 292],
    ],
    r: 63,
    extra: "M110 150 L94 158 L94 262 L110 270 Z",
    lines: "M306 68 L306 160 M466 66 L466 160 M150 200 L880 206",
  },
  pickup: {
    body: "M114 336 L112 176 L420 172 L440 98 C444 92 450 90 458 90 L610 90 C622 90 630 96 636 104 L690 168 L868 178 C884 179 892 188 892 204 L892 336 L782 336 A76 76 0 1 0 656 336 L293 336 A76 76 0 1 0 167 336 Z",
    glass: "M462 104 L606 102 L652 162 L458 164 Z",
    wheels: [
      [230, 294],
      [719, 294],
    ],
    r: 62,
    lines: "M540 102 L540 164 M112 184 L418 182",
  },
};

const BODY_DEFAULT: Record<BodyType, SilhouetteId> = {
  supercar: "supercar",
  coupe: "coupe",
  convertible: "coupe",
  sedan: "sedan",
  wagon: "sedan",
  suv: "suv",
  pickup: "pickup",
};

const BOXY = /\b(g ?63|g-class|land cruiser|defender|g 500)\b/i;

export function silhouetteFor(v: Pick<Vehicle, "bodyType" | "model">): SilhouetteId {
  if (BOXY.test(v.model)) return "suv-box";
  return BODY_DEFAULT[v.bodyType];
}

function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const spokes = Array.from({ length: 5 }, (_, i) => (i * 2 * Math.PI) / 5 - Math.PI / 2);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#050506" stroke="rgba(241,240,236,0.75)" strokeWidth="1.3" />
      <circle cx={cx} cy={cy} r={r * 0.68} fill="none" stroke="rgba(241,240,236,0.45)" strokeWidth="1" />
      {spokes.map((a, i) => (
        <path
          key={i}
          d={`M${cx + Math.cos(a - 0.12) * r * 0.16} ${cy + Math.sin(a - 0.12) * r * 0.16} L${cx + Math.cos(a - 0.08) * r * 0.66} ${cy + Math.sin(a - 0.08) * r * 0.66} M${cx + Math.cos(a + 0.12) * r * 0.16} ${cy + Math.sin(a + 0.12) * r * 0.16} L${cx + Math.cos(a + 0.08) * r * 0.66} ${cy + Math.sin(a + 0.08) * r * 0.66}`}
          stroke="rgba(241,240,236,0.4)"
          strokeWidth="1"
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.14} fill="none" stroke="rgba(241,240,236,0.55)" strokeWidth="1" />
      <line x1={cx} y1={cy - r - 10} x2={cx} y2={cy + r + 26} stroke="rgba(217,187,146,0.35)" strokeWidth="0.8" strokeDasharray="2 4" />
    </g>
  );
}

export function StudioPlate({
  vehicle,
  className,
  variant = "card",
}: {
  vehicle: Pick<Vehicle, "slug" | "bodyType" | "model" | "exterior">;
  className?: string;
  variant?: "card" | "hero";
}) {
  const sil = SILHOUETTES[silhouetteFor(vehicle)];
  const id = `sp-${vehicle.slug}-${variant}`;
  const paint = vehicle.exterior.hex;
  const hero = variant === "hero";
  const [w0, w1] = sil.wheels;

  return (
    <svg
      className={className}
      viewBox={hero ? "-420 -150 1840 700" : "40 20 920 440"}
      preserveAspectRatio={hero ? "xMidYMax meet" : "xMidYMid meet"}
      role="img"
      aria-label={`Studio drawing, ${vehicle.exterior.name}`}
    >
      <defs>
        <radialGradient id={`${id}-bg`} gradientUnits="userSpaceOnUse" cx="520" cy="200" r="760">
          <stop offset="0" stopColor="#1b1c20" />
          <stop offset="0.5" stopColor="#0b0b0d" />
          <stop offset="1" stopColor="#040405" />
        </radialGradient>
        <pattern id={`${id}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        </pattern>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={paint} stopOpacity="0.95" />
          <stop offset="0.6" stopColor={paint} stopOpacity="0.7" />
          <stop offset="1" stopColor="#000" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#23262d" />
          <stop offset="0.5" stopColor="#0a0b0d" />
          <stop offset="1" stopColor="#15171b" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" stopOpacity="0.9" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="-1500" y="-1200" width="4000" height="2600" fill={`url(#${id}-bg)`} />
      <rect x="-1500" y="-1200" width="4000" height="2600" fill={`url(#${id}-grid)`} />
      <line x1="-1500" y1="356" x2="2500" y2="356" stroke="rgba(241,240,236,0.14)" strokeWidth="1" />
      <ellipse cx="500" cy="358" rx="410" ry="16" fill={`url(#${id}-shadow)`} />

      <path d={sil.body} fill={`url(#${id}-body)`} />
      {sil.extra && <path d={sil.extra} fill={`url(#${id}-body)`} stroke="rgba(241,240,236,0.7)" strokeWidth="1.2" />}
      <path d={sil.body} fill={`url(#${id}-sheen)`} />
      <path d={sil.glass} fill={`url(#${id}-glass)`} stroke="rgba(241,240,236,0.45)" strokeWidth="1" />
      {sil.lines && <path d={sil.lines} stroke="rgba(241,240,236,0.28)" strokeWidth="1" fill="none" />}
      <path d={sil.body} fill="none" stroke="rgba(241,240,236,0.85)" strokeWidth="1.4" strokeLinejoin="round" />
      {sil.wheels.map(([cx, cy], i) => (
        <Wheel key={i} cx={cx} cy={cy} r={sil.r} />
      ))}

      {/* Wheelbase dimension line */}
      <g stroke="rgba(217,187,146,0.55)" strokeWidth="0.9" fill="none">
        <line x1={w0[0]} y1={392} x2={w1[0]} y2={392} />
        <path d={`M${w0[0] + 8} 388 L${w0[0]} 392 L${w0[0] + 8} 396 M${w1[0] - 8} 388 L${w1[0]} 392 L${w1[0] - 8} 396`} />
      </g>
      <text
        x={(w0[0] + w1[0]) / 2}
        y={414}
        textAnchor="middle"
        fill="rgba(217,187,146,0.7)"
        fontFamily="var(--font-mono), monospace"
        fontSize="11"
        letterSpacing="3"
      >
        {vehicle.exterior.name.toUpperCase()}
      </text>
    </svg>
  );
}
