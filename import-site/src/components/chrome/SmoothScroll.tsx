"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger);

const LenisContext = createContext<Lenis | null>(null);

export function useLenis() {
  return useContext(LenisContext);
}

/** Scroll to an in-page target, through Lenis when it's running. */
export function scrollToTarget(lenis: Lenis | null, target: string | HTMLElement | number, offset = 0) {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (typeof target === "number") window.scrollTo({ top: target, behavior: "smooth" });
  else {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    el?.scrollIntoView({ behavior: "smooth" });
  }
}

/**
 * Inertial scrolling shared by the whole site. Lenis drives GSAP's
 * ticker so ScrollTrigger, the WebGL director and Lenis all advance on
 * the same frame. Disabled for reduced-motion users (native scroll).
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const instance = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      syncTouch: false,
    });
    instance.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the instance only exists client-side
    setLenis(instance);
    return () => {
      gsap.ticker.remove(tick);
      instance.destroy();
      setLenis(null);
    };
  }, []);

  // New route → start at the top (or at the hash target).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const hash = window.location.hash;
    if (hash) {
      requestAnimationFrame(() => scrollToTarget(lenis, hash));
    } else {
      lenis?.scrollTo(0, { immediate: true });
      window.scrollTo(0, 0);
    }
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [pathname, lenis]);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
