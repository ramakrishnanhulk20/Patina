"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The signature moment: the five signals, advanced by scroll.
 *
 * On desktop the section is tall and its inner panel pins, so scrolling walks the
 * highlight down the list, Age through Breadth, lighting the matching bar on the
 * card as it goes. It is the raycash scroll-storytelling move, on Patina's own
 * data, and it uses plain sticky positioning plus a scroll-progress read (no
 * library), which behaves cleanly under the app's Lenis smooth scroll.
 *
 * On phones there is no room to pin, so it collapses to a static, fully expanded
 * list with the whole card lit. Reduced motion gets the same static state.
 */

const SIGNALS = [
  {
    name: "Age",
    weight: 40,
    pct: 96,
    n: "38.4",
    desc: "The oldest date provable across everything you connect. Twelve years scores full marks.",
  },
  {
    name: "Corroboration",
    weight: 20,
    pct: 85,
    n: "17.0",
    desc: "Two unrelated platforms independently agreeing on how far back you go. One old account can be bought. Two, on different services, is far harder to arrange.",
  },
  {
    name: "Depth",
    weight: 20,
    pct: 71,
    n: "14.2",
    desc: "The things you actually made. Posts, videos, repositories. Tedious to fake at volume.",
  },
  {
    name: "Standing",
    weight: 10,
    pct: 64,
    n: "6.4",
    desc: "Others treating you as real. Weighted lowest on purpose, because followers are the easiest thing on this list to buy.",
  },
  {
    name: "Breadth",
    weight: 10,
    pct: 80,
    n: "8.0",
    desc: "Independent accounts telling the same story. Faking one is easy. Faking four, each with its own decade behind it, is a different job.",
  },
];

const COUNT = SIGNALS.length;

export function ScoreScrolly() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setActive(0);
      return;
    }
    const section = sectionRef.current;
    if (!section) return;

    // Read the section's own position each frame, but ONLY while it is on screen.
    // Reading the live rect rather than listening for scroll events makes the
    // scrub correct no matter how the page is scrolled (the app runs Lenis smooth
    // scroll over the native one), and setActive bails when the value is unchanged
    // so a steady frame does not re-render.
    let rafId = 0;
    let running = false;

    const tick = () => {
      const rect = section.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      if (span > 0) {
        let p = -rect.top / span;
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        setActive(Math.min(COUNT - 1, Math.floor(p * COUNT)));
      }
      if (running) rafId = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          rafId = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(rafId);
        }
      },
      { threshold: 0 },
    );
    io.observe(section);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      io.disconnect();
    };
  }, [isDesktop]);

  // Lit means fully shown: the active row on desktop, or every row on phones.
  const lit = (i: number) => !isDesktop || active === i;

  return (
    <section
      id="score"
      ref={sectionRef}
      className="relative border-t border-line bg-panel"
      style={isDesktop ? { minHeight: `${COUNT * 60 + 100}vh` } : undefined}
    >
      <div className="flex items-center py-20 lg:sticky lg:top-0 lg:min-h-screen lg:py-0">
        <div className="mx-auto w-full max-w-[73rem] px-6">
          <div className="mb-12 max-w-[44rem]" data-reveal>
            <p className="t-eyebrow flex items-center gap-2 text-accent-ink">
              <span className="rings" aria-hidden="true" />
              The score
            </p>
            <h2 className="t-section mt-5 text-text">
              Five signals, weighted by what they cost in time.
            </h2>
          </div>

          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            {/* The list of signals. Click to jump; scroll to walk. */}
            <div className="flex flex-col">
              {SIGNALS.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={active === i ? "true" : undefined}
                  className={`block w-full border-l-2 py-4 pl-6 text-left transition-colors duration-300 ${
                    lit(i) ? "border-accent" : "border-line"
                  }`}
                >
                  <span
                    className="flex items-baseline gap-3 transition-opacity duration-300"
                    style={{ opacity: lit(i) ? 1 : 0.45 }}
                  >
                    <span className="text-2xl font-semibold tracking-tight text-text sm:text-[2rem]">
                      {s.name}
                    </span>
                    <span
                      className="t-mono text-xs text-accent-ink transition-opacity duration-300"
                      style={{ opacity: lit(i) ? 1 : 0 }}
                    >
                      {s.weight} pts
                    </span>
                  </span>
                  <div
                    className={`grid transition-all duration-500 max-lg:grid-rows-[1fr] max-lg:opacity-100 ${
                      active === i ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <p className="min-h-0 overflow-hidden text-[0.98rem] leading-relaxed text-text-2 max-lg:mt-2">
                      {s.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* The score card, on a dark band so it reads as the artifact. */}
            <div
              data-reveal="right"
              className="rounded-[22px] border border-band-line bg-band p-7 text-band-ink shadow-[var(--shadow-lg)] sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <span className="t-mono text-xs text-band-ink-2">Patina score</span>
                  <span className="text-[4.2rem] font-extrabold leading-[0.85] tracking-tight tabular-nums text-on-band">
                    83
                  </span>
                  <span className="text-lg font-semibold">Deeply worn in</span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-xs text-band-ink-2">Oldest signal</span>
                  <span className="t-mono text-[1.7rem] font-semibold tracking-tight">2013</span>
                  <span className="text-xs text-band-ink-2">YouTube, 13.1 years</span>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3">
                {SIGNALS.map((s, i) => (
                  <div
                    key={s.name}
                    className="grid grid-cols-[6.5rem_1fr_2.6rem] items-center gap-3 text-sm transition-opacity duration-300"
                    style={{ opacity: lit(i) ? 1 : 0.42 }}
                  >
                    <span>{s.name}</span>
                    <span className="h-[7px] overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full transition-colors duration-300"
                        style={{
                          width: `${s.pct}%`,
                          background: lit(i) ? "var(--on-band)" : "var(--band-ink-2)",
                        }}
                      />
                    </span>
                    <span className="text-right tabular-nums text-band-ink-2">{s.n}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-2 border-t border-band-line pt-4 text-xs text-band-ink-2">
                <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden="true">
                  <circle cx="7" cy="7" r="6" fill="none" stroke="var(--on-band)" strokeOpacity="0.5" />
                  <path
                    d="M4.4 7.2l1.8 1.8L9.8 5.4"
                    fill="none"
                    stroke="var(--on-band)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Signed by Patina, verifiable by anyone without asking us
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
