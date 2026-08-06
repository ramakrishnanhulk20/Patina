"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * One island that reveals every `[data-rise]` element on the page as it scrolls
 * into view: a short rise and fade, fired once. This keeps the page itself
 * server-rendered (the content is all in the HTML) while GSAP + ScrollTrigger
 * do the motion, the way the reference does it.
 *
 * Reduced motion opts out entirely: the elements are already in their finished
 * state, so nothing is hidden and nothing moves.
 */
export function ScrollReveals() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((el) => {
        gsap.from(el, {
          y: 38,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
