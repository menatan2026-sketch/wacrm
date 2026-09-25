"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Tweens between values with an expo-out curve and tabular figures, so
 * digits roll instead of jumping. Writes to the DOM directly — no
 * re-render per frame.
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  duration = 1100,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(value);
  const formatRef = useRef(format);
  // Rendered once; afterwards the DOM text is owned by the tween below.
  const [initial] = useState(() => format(value));
  useLayoutEffect(() => {
    formatRef.current = format;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduced || start === value) {
      el.textContent = formatRef.current(value);
      from.current = value;
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(2, -10 * t);
      const v = start + (value - start) * (t === 1 ? 1 : e);
      el.textContent = formatRef.current(v);
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span ref={ref} className={`num ${className ?? ""}`}>
      {initial}
    </span>
  );
}
