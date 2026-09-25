/**
 * Hairline icon set, drawn on a 24px grid at 1.25 stroke to match the
 * typography. Kept in-house so the line weight is consistent everywhere.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "square" as const,
  "aria-hidden": true,
  ...p,
});

export const ArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);
export const ArrowUpRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);
export const ArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v15M6 13l6 6 6-6" />
  </svg>
);
export const Plus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const Close = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const Check = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12.5 10 17 19 7" />
  </svg>
);
export const Sparkle = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5 15 9M9 15l-2.5 2.5" />
  </svg>
);
export const Light = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 7c-3 0-5 2-5 5s2 5 5 5h2V7H9ZM14 8l6-1.5M14 12h6.5M14 16l6 1.5" />
  </svg>
);
export const Rotate = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
  </svg>
);
export const Spec = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h10M4 18h13" />
  </svg>
);
export const WhatsApp = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.5L4.5 19.5Z" />
    <path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .4-.1.6l-.4.5c-.1.2-.1.3 0 .5.5.9 1.3 1.6 2.2 2.1.2.1.4.1.5-.1l.5-.6c.2-.2.4-.2.6-.1l1.4.7c.2.1.3.3.3.5v.4c0 .4-.2.8-.6 1-.5.3-1.2.4-1.9.2-2.2-.7-4-2.4-4.8-4.6-.3-.8-.2-1.8.3-2.5Z" />
  </svg>
);
export const Instagram = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="16" rx="4.5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="17" cy="7" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);
export const Mail = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 6.5h17v11h-17z" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
export const Phone = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.5 4h3l1.5 4-2 1.2a10 10 0 0 0 5.8 5.8L16 13l4 1.5v3c0 .8-.7 1.5-1.5 1.5C10.4 19 5 13.6 5 5.5 5 4.7 5.7 4 6.5 4Z" />
  </svg>
);
export const Filter = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);
export const Globe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5S9.6 5.9 12 3.5Z" />
  </svg>
);
export const Shield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6l7-2.5Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);
/** Car door rising on its hinge. */
export const Door = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 19h12l4-6V9H9L4 14v5ZM9 9 14 3M12 15h2" />
  </svg>
);
/** Front bonnet lifted. */
export const Hood = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 17h18M5 17l2-4h10l2 4M7 13 15 5l3 1-5 7" />
  </svg>
);
/** Rear hatch / engine cover. */
export const Hatch = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 17h18M5 17l2-4h10l2 4M17 13 9 5 6 6l5 7" />
  </svg>
);
/** Driver's seat — the cabin camera. */
export const Seat = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 4h4l-1 9h7l-1 4H7L6 13l2-9ZM9 17v3M15 17v3" />
  </svg>
);
/** Starlight headliner. */
export const Stars = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v4M10 6h4M6 12v3M4.5 13.5h3M17 11v5M14.5 13.5h5M9 18.5h.01M15 5.5h.01M19 19h.01" />
  </svg>
);
