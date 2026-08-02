"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveals its children as they scroll into view — a slide in from a direction
 * plus a fade. One-shot: it does not re-hide when scrolled back past. Honours
 * reduced motion by showing immediately, and the layout carries a <noscript>
 * rule that shows everything if JS never runs, so content is never trapped
 * behind the effect.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  direction?: "up" | "left" | "right";
  /** Stagger, in ms, for items revealed together. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      // A little before the element is fully on screen, so it lands as you reach it.
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className ? `reveal ${className}` : "reveal"}
      data-dir={direction}
      data-shown={shown ? "true" : undefined}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
