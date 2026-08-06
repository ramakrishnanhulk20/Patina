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
    // The theme was applied with transitions suppressed (see layout.tsx and the
    // .theme-sync rule in globals.css) so no colour transition could stick at the
    // pre-theme value. This effect runs after the first themed paint, so it is
    // the right moment to let transitions run again. It must sit ahead of the
    // reduced-motion early return so it always fires, on every page.
    document.documentElement.classList.remove("theme-sync");

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
