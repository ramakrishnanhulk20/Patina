"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Smooth scroll, the single biggest "why does this feel premium" upgrade for a
 * few lines. Desktop wheel scrolling glides instead of jumping; touch is left
 * native (Lenis does not smooth touch by default), so phones keep their normal
 * flick and nothing fights the browser. Opts out entirely under reduced motion.
 *
 * Renders nothing. It just drives one rAF loop for the life of the page.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
