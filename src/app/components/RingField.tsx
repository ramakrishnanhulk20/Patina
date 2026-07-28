"use client";

import { useEffect, useRef } from "react";

/**
 * The hero background: a field of growth rings.
 *
 * The idea it carries: a ring is a mark that can only form by lasting. You
 * cannot draw one in an afternoon. That is the entire argument of the product,
 * so the background makes it before a word is read.
 *
 * Interaction: the field sits almost invisible, tarnished. Moving the pointer
 * polishes a patch of it and the rings underneath brighten, then dim again once
 * you move on. Nothing is clickable and nothing is explained; it just rewards
 * moving the mouse.
 *
 * Performance notes, because this runs behind the most important screen we have:
 *   - one requestAnimationFrame loop, no React state, so React never re-renders
 *   - the loop stops entirely when the canvas scrolls out of view
 *   - honours prefers-reduced-motion by painting one static frame and stopping
 */
export function RingField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;
    let start = performance.now();

    // Pointer, in css pixels. Far away by default so nothing is polished.
    const pointer = { x: -9999, y: -9999, strength: 0 };

    type Seed = { x: number; y: number; rings: number; gap: number; drift: number; phase: number };
    let seeds: Seed[] = [];

    /**
     * Deterministic scatter. A real random() reshuffles on every resize, which
     * makes rotating a phone look like the page broke.
     */
    function mulberry(seed: number) {
      return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function layout() {
      const rect = canvas!.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scales with area so a phone does not get a soup of rings.
      const count = Math.max(5, Math.min(16, Math.round((width * height) / 130000)));
      const rand = mulberry(20260728);

      seeds = Array.from({ length: count }, () => ({
        x: rand() * width,
        y: rand() * height,
        rings: 5 + Math.floor(rand() * 6),
        gap: 15 + rand() * 26,
        drift: 0.4 + rand() * 0.9,
        phase: rand() * Math.PI * 2,
      }));
    }

    function frame(now: number) {
      if (!running) return;

      const t = (now - start) / 1000;
      ctx!.clearRect(0, 0, width, height);
      ctx!.lineWidth = 1;

      for (const seed of seeds) {
        // Rings breathe outward very slowly, then reset. Growth, not pulsing.
        const grow = ((t * seed.drift * 0.06 + seed.phase) % 1) * seed.gap;

        for (let i = 0; i < seed.rings; i += 1) {
          const radius = seed.gap * (i + 1) + grow;

          // Fade the outermost ring out as it goes, so nothing pops.
          const life = 1 - i / seed.rings;
          let alpha = 0.05 * life;

          // Polish: brighten rings whose stroke passes near the pointer.
          if (pointer.strength > 0.001) {
            const dx = pointer.x - seed.x;
            const dy = pointer.y - seed.y;
            const distToCentre = Math.hypot(dx, dy);
            // How close the pointer is to this specific ring's circumference.
            const offRing = Math.abs(distToCentre - radius);
            if (offRing < 150) {
              const near = 1 - offRing / 150;
              alpha += 0.5 * near * near * pointer.strength;
            }
          }

          if (alpha <= 0.004) continue;

          ctx!.strokeStyle = `rgba(53, 224, 161, ${Math.min(alpha, 0.6)})`;
          ctx!.beginPath();
          ctx!.arc(seed.x, seed.y, radius, 0, Math.PI * 2);
          ctx!.stroke();
        }
      }

      // Ease the polish away when the pointer leaves.
      pointer.strength *= 0.94;

      raf = requestAnimationFrame(frame);
    }

    function onPointerMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.strength = 1;
    }

    function onPointerLeave() {
      pointer.strength = 0;
    }

    /**
     * Paint once, synchronously, without waiting for a frame callback.
     *
     * Two reasons this matters. A canvas laid out at zero height on first paint
     * would otherwise stay empty until something else nudged it. And rAF does
     * not fire at all in a tab that is not compositing, so anything that
     * depends on the loop for its FIRST paint shows a blank hero.
     */
    function paintNow() {
      const wasRunning = running;
      running = true;
      frame(performance.now());
      cancelAnimationFrame(raf);
      running = wasRunning;
    }

    layout();
    paintNow();

    // Re-seed and repaint on resize in BOTH modes. The reduced-motion path used
    // to return before reaching this, which left those users with a field sized
    // for whatever the viewport happened to be at hydration.
    const resize = new ResizeObserver(() => {
      layout();
      paintNow();
    });
    resize.observe(canvas);

    if (reduced) {
      // The composition, without the motion. No loop, no pointer polish.
      return () => {
        running = false;
        cancelAnimationFrame(raf);
        resize.disconnect();
      };
    }

    running = true;
    raf = requestAnimationFrame(frame);

    // Stop burning frames once the hero is off screen.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          start = performance.now();
          raf = requestAnimationFrame(frame);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 },
    );
    visibility.observe(canvas);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      resize.disconnect();
      visibility.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
