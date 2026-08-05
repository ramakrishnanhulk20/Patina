"use client";

import { useEffect, useRef } from "react";

/**
 * Gives the hero cinematic depth: its content drifts up and fades as you scroll
 * into the page, so the opening lines lift away rather than merely scrolling off.
 *
 * Cheap and safe, because this sits on the most important — and most
 * mobile-heavy — screen we have:
 *   - transforms and opacity only (compositor-friendly, no layout thrash)
 *   - one rAF-throttled scroll read, and it stops entirely once the hero leaves
 *     the viewport
 *   - reduced motion opts out completely; the content just scrolls normally
 *   - the transform is applied from an effect, not during render, so the
 *     server-rendered hero is untouched and there is no first-paint shift
 */
export function HeroParallax({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let ticking = false;
    let onScreen = true;

    const apply = () => {
      ticking = false;
      if (!onScreen) return;
      const vh = window.innerHeight || 1;
      // 0 at the top, 1 after one viewport of scrolling.
      const p = Math.min(Math.max((window.scrollY || 0) / vh, 0), 1);
      el.style.transform = `translate3d(0, ${(p * -64).toFixed(1)}px, 0)`;
      el.style.opacity = `${(1 - p * 0.85).toFixed(3)}`;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        raf = requestAnimationFrame(apply);
      }
    };

    // Only pay the scroll cost while the hero is actually on screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) apply();
      },
      { threshold: 0 },
    );
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();

    return () => {
      onScreen = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
