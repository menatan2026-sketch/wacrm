"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CHAPTERS, director, type ChapterId, type QualityTier } from "./director";
import { Effects } from "./Effects";
import { StageScene } from "./StageScene";
import styles from "./StageCanvas.module.css";

function detectQuality(): QualityTier {
  const forced = new URLSearchParams(window.location.search).get("quality");
  if (forced === "low" || forced === "medium" || forced === "high") return forced;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse && small) return "low";
  if (coarse || cores <= 4) return "medium";
  return "high";
}

/**
 * Reads every `[data-chapter]` section each tick and tells the director
 * which chapter owns the screen, how far through it we are, and whether
 * any 3D chapter is visible at all. Also writes `--p` onto each section
 * so CSS can choreograph typography off the same progress value.
 */
function useChapterTicker(onVisibility: (v: boolean) => void) {
  useEffect(() => {
    let lastVisible = true;
    const tick = () => {
      const vh = window.innerHeight;
      const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-chapter]"));
      let active: HTMLElement | null = null;
      let anyVisible = false;
      for (const el of sections) {
        const r = el.getBoundingClientRect();
        const inView = r.bottom > 0 && r.top < vh;
        if (inView) anyVisible = true;
        if (r.top <= vh * 0.5) active = el;
        if (inView || el === active) {
          const range = Math.max(1, r.height - vh);
          const p = Math.min(1, Math.max(0, -r.top / range));
          el.style.setProperty("--p", p.toFixed(4));
          el.style.setProperty("--enter", Math.min(1, Math.max(0, 1 - r.top / vh)).toFixed(4));
          el.style.setProperty("--exit", Math.min(1, Math.max(0, (vh - r.bottom) / vh + 1)).toFixed(4));
        }
      }
      if (!active && sections[0]) active = sections[0];
      if (active) {
        const id = active.dataset.chapter as ChapterId;
        if (CHAPTERS.includes(id)) {
          const r = active.getBoundingClientRect();
          director.chapter = id;
          director.progress = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh)));
          document.documentElement.dataset.stageChapter = id;
        }
      }
      if (anyVisible !== lastVisible) {
        lastVisible = anyVisible;
        director.visible = anyVisible;
        onVisibility(anyVisible);
      }
    };
    gsap.ticker.add(tick);
    tick();
    return () => gsap.ticker.remove(tick);
  }, [onVisibility]);
}

function FrameloopSwitch({ visible }: { visible: boolean }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    setFrameloop(visible ? "always" : "never");
  }, [visible, setFrameloop]);
  return null;
}

export default function StageCanvas() {
  const [quality, setQuality] = useState<QualityTier | null>(null);
  const [dpr, setDpr] = useState(1.5);
  const [visible, setVisible] = useState(true);
  const fadeRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useChapterTicker(setVisible);

  useEffect(() => {
    const q = detectQuality();
    director.quality = q;
    director.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tier depends on the device
    setQuality(q);
    setDpr(q === "high" ? Math.min(window.devicePixelRatio, 2) : q === "medium" ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 1.25));

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      director.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      director.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Drag-to-rotate in the configurator chapter.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let lastX = 0;
    let lastT = 0;
    const down = (e: PointerEvent) => {
      if (director.chapter !== "know") return;
      director.drag.active = true;
      director.drag.velocity = 0;
      lastX = e.clientX;
      lastT = performance.now();
      el.setPointerCapture(e.pointerId);
      document.body.dataset.dragging = "true";
    };
    const move = (e: PointerEvent) => {
      if (!director.drag.active) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dyaw = (dx / window.innerWidth) * Math.PI * 1.6;
      director.drag.yaw += dyaw;
      director.drag.velocity = dyaw / Math.max(0.008, (now - lastT) / 1000);
      lastX = e.clientX;
      lastT = now;
    };
    const up = () => {
      director.drag.active = false;
      delete document.body.dataset.dragging;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div ref={wrapRef} className={styles.stage} data-visible={visible} data-stage-drag aria-hidden="true">
      {quality && (
        <Canvas
          dpr={dpr}
          camera={{ fov: 30, near: 0.05, far: 400, position: [6, 1.5, 7] }}
          shadows
          gl={{
            antialias: quality === "low" ? false : quality === "medium",
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.0;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
          eventSource={wrapRef as React.RefObject<HTMLElement>}
          eventPrefix="client"
        >
          <FrameloopSwitch visible={visible} />
          <PerformanceMonitor
            flipflops={3}
            onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
            onIncline={() => setDpr((d) => Math.min(quality === "high" ? 2 : 1.5, d + 0.25))}
          />
          <StageScene
            onFade={(v) => {
              if (fadeRef.current) fadeRef.current.style.opacity = v.toFixed(3);
            }}
          />
          {quality !== "low" && <Effects quality={quality} />}
        </Canvas>
      )}
      <div className={styles.vignette} />
      <div ref={fadeRef} className={styles.fade} />
    </div>
  );
}
