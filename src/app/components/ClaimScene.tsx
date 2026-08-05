"use client";

import { useEffect, useRef } from "react";
import { SectionLabel } from "./SectionLabel";

/**
 * The signature scene: everything the internet uses to judge whether you are
 * real is for sale — except time.
 *
 * A pinned statement holds one side while, on the other, each fakeable signal
 * rises into place and is struck off as it settles. The last row — a decade of
 * history — stays whole and takes the accent: the one thing left standing.
 *
 * Mechanics kept robust for a mobile-heavy audience: one IntersectionObserver
 * flips `data-shown` per row (CSS does the rest — see globals.css), each row
 * fires once, the pin is pure CSS `position: sticky` that simply does not engage
 * on a phone (where the columns stack), and reduced motion resolves every row at
 * once with no movement.
 */
const FAKEABLE = [
  { thing: "Followers", verdict: "Bought by the thousand" },
  { thing: "Activity", verdict: "Bulk uploaded overnight" },
  { thing: "A filled-in profile", verdict: "Faked in an afternoon" },
  { thing: "Engagement", verdict: "Botted" },
];

export function ClaimScene() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-strike-row]"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rows.forEach((row) => (row.dataset.shown = "true"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.shown = "true";
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.6, rootMargin: "0px 0px -10% 0px" },
    );
    rows.forEach((row) => io.observe(row));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={root}>
      <SectionLabel>The one thing that cannot be bought</SectionLabel>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
        {/* The pinned claim — it holds while the proof scrolls past it. */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="t-section text-text">
            Followers can be bought. Posts can be bulk uploaded. Time cannot.
          </h2>
          <div className="mt-6 space-y-5 text-lg leading-relaxed text-text-2">
            <p>
              Somebody running a thousand fake accounts can buy every signal the internet normally
              uses to decide whether you are real. Followers, activity, a filled-in profile. All of
              it is for sale.
            </p>
            <p>
              What they cannot buy is a decade. So Patina scores the things that only exist because
              time passed, and treats everything else as nearly worthless until there is real
              history sitting underneath it.
            </p>
          </div>
        </div>

        {/* The proof: each fakeable signal lands, then is struck off. */}
        <div className="space-y-4 lg:pt-2">
          {FAKEABLE.map((item) => (
            <div
              key={item.thing}
              data-strike-row
              data-fakeable
              className="strike-row flex items-center justify-between gap-4 border border-line bg-panel p-6"
            >
              <span className="relative text-lg font-semibold text-text-2">
                {item.thing}
                <span aria-hidden="true" className="strike-line" />
              </span>
              <span className="t-label shrink-0 text-text-4">{item.verdict}</span>
            </div>
          ))}

          {/* The survivor. No strike; it takes the accent and the mark. */}
          <div
            data-strike-row
            className="strike-row raise flex items-center justify-between gap-4 border border-accent/40 bg-accent-wash p-6"
          >
            <span className="flex items-center gap-3 text-lg font-semibold text-text">
              <span className="rings shrink-0" aria-hidden="true" />
              A decade of history
            </span>
            <span className="t-label shrink-0 text-accent">Not for sale</span>
          </div>
        </div>
      </div>
    </div>
  );
}
