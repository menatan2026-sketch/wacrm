"use client";
import { AnimatePresence, domAnimation, LazyMotion, m, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { motion as tokens } from "@mfg/tokens";

/**
 * Motion provider: honours the OS setting and the in-app override (MOTION_SYSTEM §6). Motion's
 * feature bundle is loaded lazily, so pages that only use CSS micro-interactions pay nothing.
 */
export function MotionProvider({ preference, children }: { preference: "system" | "reduced" | "full"; children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={preference === "reduced" ? "always" : preference === "full" ? "never" : "user"}>{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Wizard step transition: next enters from inline-end, back from inline-start (mirrored in RTL). */
export function StepTransition({ stepKey, direction, dir, children }: { stepKey: string; direction: 1 | -1; dir: "ltr" | "rtl"; children: ReactNode }) {
  const inline = dir === "rtl" ? -1 : 1;
  const dx = tokens.distance.l * direction * inline;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={stepKey}
        initial={{ opacity: 0, x: dx }}
        animate={{ opacity: 1, x: 0, transition: { duration: tokens.duration.standard / 1000, ease: [0, 0, 0, 1] } }}
        exit={{ opacity: 0, x: -dx, transition: { duration: (tokens.duration.standard * 0.75) / 1000, ease: [0.3, 0, 1, 1] } }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

/** Price/value change: crossfade with a 4 px slide — never a counting animation for money. */
export function ValueSwap({ value, children }: { value: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <m.span key={value} initial={{ opacity: 0, y: tokens.distance.s }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -tokens.distance.s }} transition={{ duration: tokens.duration.fast / 1000 }} className="inline-block">
        {children}
      </m.span>
    </AnimatePresence>
  );
}
