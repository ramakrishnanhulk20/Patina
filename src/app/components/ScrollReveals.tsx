"use client";

import { useEffect } from "react";

/**
 * Reveals [data-rise] elements as they scroll into view: a short fade and rise.
 *
 * Two rules keep it from ever hiding something a visitor should see:
 *
 *   1. Anything already on screen at load is left ALONE, never hidden. The hero
 *      and the whole first screen are visible immediately and do not depend on a
 *      scroll ever happening. (The previous GSAP ScrollTrigger version left the
 *      hero at opacity 0 until the first scroll, which read as a blank page.)
 *   2. Only elements below the fold are hidden, then revealed on intersection.
 *
 * The content ships visible in the server HTML, so reduced motion and no-JS both
 * simply keep it visible: this effect is the only thing that ever hides it, and
 * it only touches what is safely out of view.
 */
export function ScrollReveals() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-rise]"));
    if (!els.length) return;

    const vh = window.innerHeight;
    const pending: HTMLElement[] = [];
    els.forEach((el) => {
      // Already on screen: leave it visible, do not animate it in.
      if (el.getBoundingClientRect().top < vh * 0.92) return;
      el.classList.add("rise");
      pending.push(el);
    });
    if (!pending.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("rise-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    pending.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
