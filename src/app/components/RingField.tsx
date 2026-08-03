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
 * polishes a patch of it — the rings underneath brighten AND clean from a deep,
 * oxidised verdigris toward a bright one — then dim again once you move on.
 * Nothing is clickable and nothing is explained; it just rewards moving.
 *
 * ON A PHONE THERE IS NO POINTER, which once made the whole thing dead for
 * roughly nine in ten visitors. So a device with no pointer gets its own light
 * that drifts across the field, and — this is the part that makes it feel alive
 * in the hand — SCROLLING polishes it: a flick brightens the field and settles.
 *
 * The rings themselves are read as tree rings: a new one forms faint at the very
 * centre, sets as it moves out, and fades as it reaches the rim. On desktop each
 * is given a whisper of eccentricity so it reads as timber rather than radar;
 * touch keeps perfect circles, which are cheaper to stroke.
 *
 * Performance notes, because this runs behind the most important screen we have:
 *   - one requestAnimationFrame loop, no React state, so React never re-renders
 *   - touch is capped at 30fps: the drift is slow enough that it is invisible,
 *     and it halves the canvas work on the phones that are most of our traffic
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

    /**
     * Is there a real pointer to polish with?
     *
     * `(hover: hover) and (pointer: fine)` is the honest test — a phone answers
     * no, a laptop yes, and a touchscreen laptop yes, which is the right answer
     * because it still has a mouse.
     */
    const hasPointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    /**
     * The accent ramp, straight from the design system (globals.css): deep is
     * the oxidised verdigris, bright is freshly polished metal. The field lives
     * entirely on these — no new colour is introduced. Resting rings sit a touch
     * toward deep (tarnished); a polished ring cleans up toward bright.
     */
    type RGB = [number, number, number];
    const DEEP: RGB = [18, 143, 101];
    const BASE: RGB = [53, 224, 161];
    const BRIGHT: RGB = [106, 255, 192];
    const mix = (a: RGB, b: RGB, t: number): RGB => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    const REST = mix(BASE, DEEP, 0.22);

    // Touch runs at 30fps; the interval gate below enforces it. Desktop is left
    // uncapped, where the pointer-polish is felt frame to frame.
    const TOUCH_FRAME_MS = 1000 / 30;
    // Segments per warped ring. Desktop only — touch strokes plain arcs instead.
    const SEGMENTS = 48;

    let width = 0;
    let height = 0;
    let raf = 0;
    let running = true;
    let start = performance.now();
    let lastDraw = 0;

    // Pointer, in css pixels. Far away by default so nothing is polished.
    const pointer = { x: -9999, y: -9999, strength: 0 };

    // Scroll state, for the phone light. `boost` is bumped by how far the page
    // just moved and decays each frame, so a flick flares the field and settles.
    let scrollY = window.scrollY || 0;
    let lastScrollY = scrollY;
    let scrollBoost = 0;

    type Seed = {
      x: number;
      y: number;
      rings: number;
      gap: number;
      drift: number;
      phase: number;
      // Desktop-only organic warp, precomputed so a ring is a slightly irregular
      // growth ring rather than a perfect circle: two low lobes and a faint squash.
      warpA: number;
      warpB: number;
      warpPhaseA: number;
      warpPhaseB: number;
      squashX: number;
      squashY: number;
    };
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

      // Density scales with area so a phone does not get a soup of rings. The
      // floor is raised on touch, where the old minimum of five left a tall
      // narrow screen looking empty rather than sparse.
      const count = hasPointer
        ? Math.max(5, Math.min(16, Math.round((width * height) / 130000)))
        : Math.max(8, Math.min(14, Math.round((width * height) / 70000)));
      const rand = mulberry(20260728);

      seeds = Array.from({ length: count }, () => ({
        x: rand() * width,
        y: rand() * height,
        rings: 5 + Math.floor(rand() * 6),
        gap: 15 + rand() * 26,
        drift: 0.4 + rand() * 0.9,
        phase: rand() * Math.PI * 2,
        warpA: 0.02 + rand() * 0.025,
        warpB: 0.012 + rand() * 0.02,
        warpPhaseA: rand() * Math.PI * 2,
        warpPhaseB: rand() * Math.PI * 2,
        squashX: 0.97 + rand() * 0.05,
        squashY: 0.97 + rand() * 0.05,
      }));
    }

    /**
     * Add one ring's path to the current subpath.
     *
     * Touch (and any ring too small to warp meaningfully) gets a plain arc, which
     * is the cheapest circle the canvas can draw. Desktop gets the eccentric
     * version: a closed polyline whose radius wobbles with two low-frequency
     * lobes and a slight squash, precomputed per seed so it costs only the plot.
     */
    function ringPath(cx: number, cy: number, r: number, seed: Seed) {
      if (!hasPointer || r < 2) {
        ctx!.arc(cx, cy, r, 0, Math.PI * 2);
        return;
      }
      for (let s = 0; s < SEGMENTS; s += 1) {
        const a = (s / SEGMENTS) * Math.PI * 2;
        const warp =
          1 +
          seed.warpA * Math.sin(a * 2 + seed.warpPhaseA) +
          seed.warpB * Math.sin(a * 3 + seed.warpPhaseB);
        const rr = r * warp;
        const x = cx + Math.cos(a) * rr * seed.squashX;
        const y = cy + Math.sin(a) * rr * seed.squashY;
        if (s === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.closePath();
    }

    function frame(now: number, force = false) {
      if (!running) return;

      // Touch is capped at 30fps: skip the frame but keep the loop alive. Forced
      // paints (first paint, resize) and desktop always draw.
      if (!force && !hasPointer && now - lastDraw < TOUCH_FRAME_MS) {
        raf = requestAnimationFrame(frame);
        return;
      }
      lastDraw = now;

      const t = (now - start) / 1000;
      ctx!.clearRect(0, 0, width, height);
      ctx!.lineWidth = 1;

      /**
       * Without a pointer, the light moves by itself AND answers the scroll.
       *
       * Two sine waves at unrelated periods keep it drifting so the field is
       * never dead, kept off the edges so the bright patch is where the eye is.
       * On top of that, `scrollBoost` — how hard the page was just flicked —
       * flares the polish and eases off, and scroll position nudges the light up
       * the field as the reader moves into the page. That is what turns a canned
       * loop into something a phone user feels themselves acting on.
       */
      if (!hasPointer) {
        const sp = Math.min(scrollY / Math.max(height, 1), 1);
        pointer.x = width * (0.5 + 0.34 * Math.sin(t * 0.21));
        pointer.y = height * (0.42 + 0.3 * Math.sin(t * 0.13 + 1.7) - 0.16 * sp);
        pointer.strength = Math.min(1.15, 0.8 + 0.45 * scrollBoost);
        scrollBoost *= 0.92;
      }

      // On touch the rings have to survive a phone screen in daylight, so the
      // resting alpha is roughly double. The pointer path keeps the reviewed
      // desktop value untouched.
      const baseAlpha = hasPointer ? 0.05 : 0.1;

      for (const seed of seeds) {
        // The growth reading: the innermost ring emerges from the very centre and
        // the whole set drifts outward by one gap before the cycle repeats, so a
        // new ring is forever being born at the core.
        const cycle = (t * seed.drift * 0.06 + seed.phase) % 1;
        const grow = cycle * seed.gap;
        const rMax = seed.gap * seed.rings;

        // The pointer's distance to this seed's centre is the same for every ring
        // it owns, so measure it once here rather than once per ring below.
        let distToCentre = Infinity;
        if (pointer.strength > 0.001) {
          const dx = pointer.x - seed.x;
          const dy = pointer.y - seed.y;
          distToCentre = Math.sqrt(dx * dx + dy * dy);
        }

        for (let i = 0; i < seed.rings; i += 1) {
          const radius = seed.gap * i + grow;

          // Born faint at the centre, sets as it moves out, fades as it reaches
          // the rim — a half-sine envelope over the ring's distance from centre.
          const norm = Math.min(radius / rMax, 1);
          let alpha = baseAlpha * Math.sin(norm * Math.PI);

          // Polish: brighten rings whose stroke passes near the pointer, and
          // remember HOW polished so the colour can clean toward bright with it.
          let lit = 0;
          if (distToCentre < Infinity) {
            // How close the pointer is to this specific ring's circumference.
            const offRing = Math.abs(distToCentre - radius);
            if (offRing < 150) {
              const near = 1 - offRing / 150;
              const add = 0.5 * near * near * pointer.strength;
              alpha += add;
              lit = Math.min(1, add / 0.5);
            }
          }

          if (alpha <= 0.004) continue;

          // Clean from tarnished (deep) toward bright with the polish, along the
          // accent ramp. Inlined rather than via mix() to avoid a per-ring array.
          const cr = REST[0] + (BRIGHT[0] - REST[0]) * lit;
          const cg = REST[1] + (BRIGHT[1] - REST[1]) * lit;
          const cb = REST[2] + (BRIGHT[2] - REST[2]) * lit;
          ctx!.strokeStyle = `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, ${Math.min(alpha, 0.6)})`;
          ctx!.beginPath();
          ringPath(seed.x, seed.y, radius, seed);
          ctx!.stroke();
        }
      }

      // Ease the polish away when the pointer leaves. Only meaningful where there
      // is a pointer; the autonomous light sets its own strength above.
      if (hasPointer) pointer.strength *= 0.94;

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

    /** Bump the polish by how far the page just scrolled, then let it decay. */
    function onScroll() {
      const y = window.scrollY || 0;
      scrollBoost = Math.min(1, scrollBoost + Math.abs(y - lastScrollY) / 140);
      lastScrollY = y;
      scrollY = y;
    }

    /**
     * Paint once, synchronously, without waiting for a frame callback.
     *
     * Two reasons this matters. A canvas laid out at zero height on first paint
     * would otherwise stay empty until something else nudged it. And rAF does
     * not fire at all in a tab that is not compositing, so anything that depends
     * on the loop for its FIRST paint shows a blank hero. Forced, so the 30fps
     * gate never turns a resize repaint into a no-op.
     */
    function paintNow() {
      const wasRunning = running;
      running = true;
      frame(performance.now(), true);
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
      // The composition, without the motion. No loop, no pointer polish, no
      // scroll light — one still frame that resizes with the window.
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

    if (hasPointer) {
      // No point listening for a pointer on a device that does not have one, and
      // a stray synthetic pointermove would fight the autonomous light for it.
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerleave", onPointerLeave);
    } else {
      // The phone's light source. Passive: it only reads scroll, never blocks it.
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      resize.disconnect();
      visibility.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
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
