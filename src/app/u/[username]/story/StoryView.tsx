"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RingField } from "../../../components/RingField";
import type { Story } from "@/lib/story";

/**
 * The story, told with movement.
 *
 * Everything renders on the server too — the numbers and the words are real
 * HTML, so a crawler and a reader without JavaScript get the whole story, just
 * still. The reveals and the count-ups are enhancement layered on top, and they
 * step aside entirely for anyone who asked for reduced motion.
 */
export function StoryView({ username, story }: { username: string; story: Story }) {
  const motion = useMotionAllowed();

  return (
    <main className="relative">
      {/* ------------------------------------------------------------- opening */}
      <header className="relative isolate flex min-h-[88vh] flex-col justify-center overflow-hidden border-b border-line px-6 py-24">
        <RingField />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/70 to-bg"
        />

        <div className="relative mx-auto w-full max-w-3xl">
          <p className="t-label text-text-3">A digital life, traced</p>

          {story.startYear ? (
            <>
              <p className="mt-6 t-hero text-accent">{story.startYear}</p>
              <p className="mt-4 max-w-xl text-xl leading-relaxed text-text-2">
                The year the trail begins. Everything after is{" "}
                <span className="text-text">
                  <CountUp value={story.spanYears ?? 0} motion={motion} /> years
                </span>{" "}
                you could not go back and manufacture.
              </p>
            </>
          ) : (
            <>
              <p className="mt-6 t-hero text-accent">{story.score}</p>
              <p className="mt-4 max-w-xl text-xl leading-relaxed text-text-2">
                Your Patina, out of a hundred. Connect a source that carries a date and this becomes
                a story with a beginning.
              </p>
            </>
          )}

          <p className="t-label mt-10 text-text-4">Scroll</p>
        </div>
      </header>

      {/* -------------------------------------------------------------- origin */}
      {story.origin && (
        <Section motion={motion}>
          <p className="t-label text-text-3">Where it starts</p>
          <p className="mt-6 t-section text-text">
            It begins with {story.origin}.
          </p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-2">
            Not a thing you can open this afternoon and pretend is old. It sat there while the years
            went by, which is exactly what makes it worth something.
          </p>
        </Section>
      )}

      {/* ------------------------------------------------------------ timeline */}
      {story.timeline.length > 0 && (
        <Section motion={motion}>
          <p className="t-label text-text-3">The trail, in order</p>
          <ol className="mt-10 space-y-0">
            {story.timeline.map((entry, index) => (
              <li key={`${entry.source}-${entry.year}`} className="relative flex gap-5 pb-10 last:pb-0">
                {/* The spine, drawn between nodes. */}
                {index < story.timeline.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[7px] top-4 h-full w-px bg-line-strong"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="relative mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-accent bg-bg"
                >
                  <span className="absolute inset-[3px] rounded-full bg-accent" />
                </span>
                <div className="min-w-0">
                  <p className="t-mono text-sm text-accent">{entry.year}</p>
                  <p className="mt-1 text-xl font-semibold text-text">You {entry.label}.</p>
                </div>
              </li>
            ))}
          </ol>

          {story.alsoConnected.length > 0 && (
            <p className="mt-8 text-sm leading-relaxed text-text-3">
              Also connected, without a date to pin down: {story.alsoConnected.join(", ")}.
            </p>
          )}
        </Section>
      )}

      {/* ---------------------------------------------------------- year chart */}
      {story.postsByYear && (
        <Section motion={motion}>
          <p className="t-label text-text-3">Year by year</p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-text-2">
            Every bar is a year you showed up and left something behind.
          </p>
          <YearChart data={story.postsByYear} motion={motion} />
        </Section>
      )}

      {/* ---------------------------------------------------------------- made */}
      {story.made.total > 0 && (
        <Section motion={motion}>
          <p className="t-label text-text-3">What you left behind</p>
          <p className="mt-6 flex flex-wrap items-baseline gap-x-4">
            <span className="t-display text-accent">
              <CountUp value={story.made.total} motion={motion} />
            </span>
            <span className="text-lg text-text-2">things anyone can still go and look at</span>
          </p>

          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
            {story.made.posts > 0 && <Made label="posts" value={story.made.posts} motion={motion} />}
            {story.made.videos > 0 && <Made label="videos" value={story.made.videos} motion={motion} />}
            {story.made.repos > 0 && <Made label="repositories" value={story.made.repos} motion={motion} />}
          </div>
        </Section>
      )}

      {/* --------------------------------------------------------------- reach */}
      {(story.reach > 0 || story.vouches > 0) && (
        <Section motion={motion}>
          <p className="t-label text-text-3">Who gathered round</p>
          {story.reach > 0 && (
            <p className="mt-6 flex flex-wrap items-baseline gap-x-4">
              <span className="t-display text-text">
                <CountUp value={story.reach} motion={motion} />
              </span>
              <span className="text-lg text-text-2">follow the trail you left</span>
            </p>
          )}
          {story.vouches > 0 && (
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-2">
              And {story.vouches} time{story.vouches === 1 ? "" : "s"} an organisation or a badge
              said, in effect, that you were real — the kind of thing somebody else has to grant you.
            </p>
          )}
        </Section>
      )}

      {/* ------------------------------------------------------------- verdict */}
      <Section motion={motion}>
        <p className="t-label text-text-3">What it comes to</p>
        <p className="mt-6 flex items-baseline gap-3">
          <span className="t-display text-accent">
            <CountUp value={story.score} motion={motion} />
          </span>
          <span className="text-2xl font-semibold text-text-4">/ 100</span>
        </p>
        <p className="mt-4 text-2xl font-semibold text-text">{story.verdict}.</p>
        {story.strongest && (
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-2">
            Most of it rests on {story.strongest.label.toLowerCase()} — {story.strongest.points} of a
            possible {story.strongest.max}. The full breakdown is on your card, nothing hidden.
          </p>
        )}
      </Section>

      {/* ----------------------------------------------------------------- cta */}
      <section className="border-t border-line px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="t-section text-text">This is proof time passed. Pass it on.</h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-2">
            Every person who follows it back to their own beginning moves Patina up the Vana Cup —
            and that is the whole game.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/connect" className="btn btn-primary px-6 py-3.5 text-base">
              Share your card
            </Link>
            <Link
              href={`/u/${encodeURIComponent(username)}`}
              className="btn btn-ghost px-6 py-3.5 text-base"
            >
              Back to your card
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/** A revealed content section, centred and spaced like the rest of the app. */
function Section({ children, motion }: { children: React.ReactNode; motion: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const shown = useInView(ref, motion);

  return (
    <section
      ref={ref}
      className={`border-b border-line px-6 py-20 sm:py-28 ${motion ? "reveal" : ""}`}
      data-shown={shown ? "true" : undefined}
    >
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </section>
  );
}

function Made({ label, value, motion }: { label: string; value: number; motion: boolean }) {
  return (
    <div className="bg-bg p-6">
      <p className="t-display text-3xl text-text sm:text-4xl">
        <CountUp value={value} motion={motion} />
      </p>
      <p className="t-label mt-2 text-text-3">{label}</p>
    </div>
  );
}

/** The year-by-year bars. Heights are relative to the busiest year. */
function YearChart({ data, motion }: { data: { year: number; count: number }[]; motion: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref, motion);
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div ref={ref} className="scroll-x mt-8">
      <div className="flex min-w-full items-end gap-2" style={{ height: 180 }}>
        {data.map((d, index) => (
          <div key={d.year} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t ${d.count > 0 ? "bg-accent" : "bg-line-strong"} ${
                  motion ? "story-bar" : ""
                }`}
                data-shown={shown ? "true" : undefined}
                style={{
                  height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2)}%`,
                  transitionDelay: motion ? `${Math.min(index * 60, 600)}ms` : undefined,
                }}
                title={`${d.count} in ${d.year}`}
              />
            </div>
            <span className="t-mono text-[10px] text-text-4">{`'${String(d.year).slice(2)}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Count a number up from zero once it scrolls into view. */
function CountUp({ value, motion }: { value: number; motion: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, motion);
  // SSR and no-JS render the final value, so the story is complete without any
  // scripting. Off-screen it also just shows the final value; the count from
  // zero only runs as the number scrolls into view, under the reveal, where a
  // reset reads as intentional rather than as a glitch.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!motion || !inView) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, motion]);

  return <span ref={ref}>{display.toLocaleString("en-US")}</span>;
}

/**
 * True once the element has scrolled into view. Latches and never flips back.
 *
 * The reset when motion turns on is the important line: without it, the value
 * set during the initial no-motion render would stick and every section would
 * arrive already revealed, so nothing would ever animate.
 */
function useInView(ref: React.RefObject<HTMLElement | null>, motion: boolean): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!motion) {
      setInView(true);
      return;
    }
    setInView(false);

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, motion]);

  return inView;
}

/** Whether animation is welcome here. False under prefers-reduced-motion. */
function useMotionAllowed(): boolean {
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotion(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return motion;
}
