"use client";

import { useEffect, useRef, useState } from "react";
import type { PlateHandle } from "./plateScene";

type GlowCard3DProps = {
  username: string;
  score: number;
  verdict: string;
  year: number | null;
  years: number | null;
  children: React.ReactNode;
};

/**
 * Puts a real WebGL plate over the HTML card, when that is a good idea.
 *
 * Three things this is careful about, all of which the previous version was not:
 *
 *   THE BUNDLE. three.js is 520KB, and it used to sit in the initial chunk of
 *   the one page strangers open from a link in a chat, on mobile data. It is
 *   now behind a dynamic import that runs after paint, so the card is readable
 *   before a byte of it arrives.
 *
 *   THE BATTERY. The old loop ran forever — scrolled away, tab hidden, phone in
 *   a pocket. It now runs only while the card is actually on screen in a
 *   visible tab.
 *
 *   FAILURE. If the context will not start, nothing is swapped and the HTML
 *   card simply stays. There is no state in which this page shows an empty box.
 */
export function GlowCard3D({ username, score, verdict, year, years, children }: GlowCard3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    let handle: PlateHandle | null = null;
    let cancelled = false;
    const observers: Array<{ disconnect: () => void }> = [];
    const teardown: Array<() => void> = [];

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    void (async () => {
      // Wait for Geist before drawing type into a texture. Without this the
      // face is baked with whatever fallback happened to be resolved at that
      // instant, and the card ships with the wrong typeface permanently — a
      // canvas texture never re-renders itself the way live DOM text does.
      try {
        await document.fonts.ready;
      } catch {
        // Font loading API absent. The stack below still resolves to something.
      }
      if (cancelled) return;

      const { createPlateScene } = await import("./plateScene");
      if (cancelled) return;

      const rect = host.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      handle = createPlateScene(
        canvas,
        {
          username,
          score,
          verdict,
          year,
          years,
          fontFamily: getComputedStyle(host).fontFamily,
        },
        { width: rect.width, height: rect.height, reducedMotion },
      );

      if (!handle) return; // No WebGL. The HTML card below stays exactly as it is.
      if (cancelled) {
        handle.dispose();
        return;
      }

      setLive(true);

      const applySize = () => {
        const box = host.getBoundingClientRect();
        if (box.width > 0 && box.height > 0) handle?.resize(box.width, box.height);
      };

      const resize = new ResizeObserver(([entry]) => {
        const box = entry.contentRect;
        if (box.width > 0 && box.height > 0) handle?.resize(box.width, box.height);
      });
      resize.observe(host);
      observers.push(resize);

      // ResizeObserver is the right tool and usually enough, but it has been
      // unreliable around iOS orientation changes, where the element's box is
      // reported before the viewport has settled. A plain resize listener costs
      // nothing and means a rotated phone cannot end up with a stretched card.
      window.addEventListener("resize", applySize);
      window.addEventListener("orientationchange", applySize);
      teardown.push(() => {
        window.removeEventListener("resize", applySize);
        window.removeEventListener("orientationchange", applySize);
      });

      // Only animate while genuinely on screen. `threshold: 0` is enough: the
      // question is "is any of it visible", not "how much".
      //
      // Starts TRUE, not false. A tab opened in the background gets no initial
      // IntersectionObserver report until it is shown, and defaulting to "not
      // visible" left the card frozen on the first frame for anyone who opened
      // a shared link into a background tab and came to it later.
      let onScreen = true;
      const sync = () => {
        if (onScreen && document.visibilityState === "visible") handle?.play();
        else handle?.pause();
      };

      const visible = new IntersectionObserver(
        ([entry]) => {
          onScreen = entry.isIntersecting;
          sync();
        },
        { threshold: 0 },
      );
      visible.observe(host);
      observers.push(visible);

      document.addEventListener("visibilitychange", sync);
      teardown.push(() => document.removeEventListener("visibilitychange", sync));

      // Pointer tilt, for anyone with a pointer.
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        const box = host.getBoundingClientRect();
        handle?.setTilt(
          ((event.clientX - box.left) / box.width) * 2 - 1,
          -(((event.clientY - box.top) / box.height) * 2 - 1),
        );
      };
      const onPointerLeave = () => handle?.setTilt(0, 0);
      host.addEventListener("pointermove", onPointerMove);
      host.addEventListener("pointerleave", onPointerLeave);
      teardown.push(() => {
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
      });

      /**
       * On a phone there is no pointer, and hijacking touch would fight the
       * scroll. So the tilt comes from where the card sits in the viewport:
       * scrolling past it turns it. It reads as the card responding to you
       * without taking anything away from you.
       */
      if (!reducedMotion) {
        let queued = false;
        const onScroll = () => {
          if (queued) return;
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            const box = host.getBoundingClientRect();
            const centre = box.top + box.height / 2;
            const through = (centre / window.innerHeight) * 2 - 1;
            handle?.setTilt(through * 0.5, -through * 0.6);
          });
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        teardown.push(() => window.removeEventListener("scroll", onScroll));
        onScroll();
      }

      sync();
    })();

    return () => {
      cancelled = true;
      for (const observer of observers) observer.disconnect();
      for (const off of teardown) off();
      handle?.dispose();
      setLive(false);
    };
  }, [username, score, verdict, year, years]);

  return (
    <div
      ref={hostRef}
      className="relative w-full overflow-hidden rounded-2xl aspect-[5/4] sm:aspect-[16/10]"
    >
      {/*
        The HTML card is the real content and never leaves the document — it is
        only faded out once the plate is genuinely rendering, so the swap cannot
        produce an empty frame.
      */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          live ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden={live ? "true" : undefined}
      >
        {children}
      </div>

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
          live ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
