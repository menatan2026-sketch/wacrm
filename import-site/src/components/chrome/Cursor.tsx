"use client";

import { useEffect, useRef } from "react";
import styles from "./Cursor.module.css";

const LABELS: Record<string, string> = {
  view: "View",
  explore: "Explore",
  drag: "Drag",
  open: "Open",
};

/**
 * Desktop cursor: a precise dot plus a trailing ring that expands into a
 * labelled disc over interactive targets (`data-cursor="view|explore|drag|open"`).
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return;
    document.documentElement.dataset.cursorReady = "true";

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let raf = 0;
    let state = "";
    let visible = false;

    const setState = (next: string) => {
      if (next === state) return;
      state = next;
      ring.current!.dataset.state = next || "default";
      dot.current!.dataset.state = next || "default";
      if (label.current) label.current.textContent = LABELS[next] ?? "";
    };

    const resolve = (target: Element | null) => {
      const el = target?.closest<HTMLElement>("[data-cursor]");
      if (el?.dataset.cursor) return el.dataset.cursor;
      if (document.body.dataset.cursor) return document.body.dataset.cursor;
      if (document.body.dataset.dragging) return "drag";
      // Over the 3D stage during the configurator chapter: a door / bonnet /
      // hatch under the pointer opens on click, anywhere else drags.
      if (target?.closest("[data-stage-drag]") && document.documentElement.dataset.stageChapter === "know") {
        return document.body.dataset.hoverPart ? "open" : "drag";
      }
      if (target?.closest("a, button, [role='button'], label, select, input[type='checkbox'], input[type='radio']")) return "link";
      if (target?.closest("input, textarea")) return "text";
      return "";
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        visible = true;
        rx = x;
        ry = y;
        ring.current!.style.opacity = "1";
        dot.current!.style.opacity = "1";
      }
      setState(resolve(e.target as Element));
    };
    const leave = () => {
      visible = false;
      ring.current!.style.opacity = "0";
      dot.current!.style.opacity = "0";
    };
    const down = () => ring.current?.setAttribute("data-down", "true");
    const up = () => ring.current?.removeAttribute("data-down");

    const loop = () => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      dot.current!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      ring.current!.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      delete document.documentElement.dataset.cursorReady;
    };
  }, []);

  return (
    <div className={styles.root} aria-hidden="true">
      <div ref={ring} className={styles.ring} data-state="default">
        <span ref={label} className={styles.label} />
      </div>
      <div ref={dot} className={styles.dot} data-state="default" />
    </div>
  );
}
