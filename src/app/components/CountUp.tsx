"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The score should ARRIVE, not merely be printed — it is the payoff of the whole
 * flow, and a number that climbs into place is the difference between a result
 * and a reveal.
 *
 * Three things this is careful about:
 *
 *   HYDRATION. It renders its final value on the server and on the first client
 *   paint, so the markup matches and there is no flash of a wrong number. Only
 *   AFTER mount does it drop to the start and climb, inside an effect.
 *
 *   MOTION. Anyone who asked for reduced motion is handed the final number at
 *   once and nothing moves. Same for a zero, which has nowhere to climb from.
 *
 *   WIDTH. Tabular figures, so the digits do not jitter the layout as they tick.
 */
export function CountUp({
  value,
  durationMs = 1000,
  className = "",
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value <= 0) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — quick off the mark, soft on the landing, matching the
      // deceleration curve the rest of the app moves on.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(step);
    };

    setDisplay(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {display}
    </span>
  );
}
