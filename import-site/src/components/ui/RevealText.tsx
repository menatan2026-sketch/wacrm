"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type RevealTag = "h1" | "h2" | "h3" | "p" | "div" | "li" | "article" | "section" | "span";

/**
 * Masked word-by-word reveal when the element enters the viewport.
 * Lines are explicit (pass an array) so line breaks are art-directed,
 * not left to the browser.
 */
export function RevealText({
  lines,
  as = "h2",
  className,
  delay = 0,
  style,
  threshold = 0.35,
  id,
}: {
  id?: string;
  lines: string[];
  as?: RevealTag;
  className?: string;
  delay?: number;
  style?: CSSProperties;
  threshold?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref, threshold);
  const Tag = as as "div";
  const words = lines.map((line) => line.split(" "));
  const offsets = words.map((_, li) => words.slice(0, li).reduce((n, w) => n + w.length, 0));
  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} id={id} className={className} style={{ ...style, "--d": `${delay}ms` } as CSSProperties} data-revealed="false">
      {words.map((line, li) => (
        <span key={li} className="reveal-line">
          {line.map((word, wi) => (
            <span key={wi} className="reveal-word" style={{ "--i": offsets[li] + wi } as CSSProperties}>
              {word}
              {wi < line.length - 1 ? "\u00a0" : ""}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}

/** Sets data-revealed="true" once the element crosses the threshold. */
export function useReveal(ref: React.RefObject<HTMLElement | null>, threshold = 0.3) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.revealed = "true";
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
}

export function Reveal({
  children,
  className,
  as = "div",
  threshold = 0.25,
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: RevealTag;
  threshold?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref, threshold);
  const Tag = as as "div";
  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} className={className} style={style} data-revealed="false">
      {children}
    </Tag>
  );
}
