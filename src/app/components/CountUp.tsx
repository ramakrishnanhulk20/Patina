"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A number that climbs to its value instead of just appearing. The score
 * arriving, and reacting each time a new source lifts it.
 *
 * Four things this is careful about:
 *
 *   HYDRATION. It renders its final value on the server and on the first client
 *   paint, so the markup matches and there is no flash of a wrong number. Only
 *   AFTER mount does it drop to the start and climb, inside an effect.
 *
 *   REACTION. The first run climbs from zero. When the value later CHANGES, 
 *   a connect raising the score. It climbs from the number already on screen up
 *   to the new one, so the panel visibly reacts rather than resetting.
 *
 *   MOTION. Reduced motion (or no actual change) jumps straight to the value.
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
  // Where the next climb starts from: 0 on first run, then the last settled
  // value so a later change animates from where the eye already is.
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || value === from) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic. Quick off the mark, soft on the landing.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
      }
    };

    setDisplay(from);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, durationMs]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {display}
    </span>
  );
}
