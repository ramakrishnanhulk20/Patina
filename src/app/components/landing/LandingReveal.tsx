"use client";

import { useEffect } from "react";

/**
 * Reveals `[data-reveal]` elements as they scroll into view: a fade with a rise,
 * or a slide from the side for `data-reveal="left"` / `"right"`.
 *
 * The content ships VISIBLE in the server HTML. This adds the hidden `.rise`
 * state on the client, and only to elements below the fold at load, so the first
 * screen is never hidden and a no-JS or reduced-motion visitor keeps everything.
 * Reuses the app's `.rise` / `.rise-in` machinery and the directional variants in
 * globals.css. An optional `data-reveal-delay` staggers siblings that enter
 * together.
 */
export function LandingReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!els.length) return;

    const vh = window.innerHeight;
    const pending: HTMLElement[] = [];
    els.forEach((el) => {
      // Already on screen at load: leave it be, never hide the first view.
      if (el.getBoundingClientRect().top < vh * 0.92) return;
      const dir = el.dataset.reveal || "up";
      if (dir === "left" || dir === "right") el.dataset.dir = dir;
      el.classList.add("rise");
      pending.push(el);
    });
    if (!pending.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const delay = Number(el.dataset.revealDelay || 0);
          if (delay) el.style.transitionDelay = `${delay}ms`;
          el.classList.add("rise-in");
          io.unobserve(el);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );
    pending.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, []);

  return null;
}
