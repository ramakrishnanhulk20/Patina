"use client";

import { useEffect, useState } from "react";
import type { Component } from "@/lib/score";
import { GlowCard3D } from "../components/GlowCard3D";
import { PlateCard } from "../components/PlateCard";
import { DigitalRings } from "../components/DigitalRings";
import { VerifiedSeal } from "../components/VerifiedSeal";

export type ScoreView = {
  total: number;
  verdict: string;
  components: Component[];
  oldestSignal: { date: string; years: number; source: string } | null;
  sourcesConnected: string[];
};

/**
 * True only on desktop-width viewports.
 *
 * Starts `false` so the server render and the first client render agree (no
 * hydration mismatch), and phones simply never flip it. This gates the live
 * WebGL card below — see the note where it is used for why the 3D card must not
 * mount on phones.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    // 640px is Tailwind's `sm` breakpoint, the line the rest of the app already
    // uses to split phone from desktop.
    const query = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return isDesktop;
}

export function ScorePanel({
  score,
  username,
  rank = null,
  totalScored = 0,
}: {
  score: ScoreView;
  /** Printed on the card. Falls back to a friendly placeholder before naming. */
  username?: string | null;
  /** Leaderboard position, if known — turns into the "Top X%" standing. */
  rank?: number | null;
  /** Size of the field the rank sits in; the percentile is meaningless below a floor. */
  totalScored?: number;
}) {
  const empty = score.sourcesConnected.length === 0;
  const year = score.oldestSignal ? new Date(score.oldestSignal.date).getFullYear() : null;
  const years = score.oldestSignal ? Math.floor(score.oldestSignal.years) : null;
  const name = username && username.trim() ? username : "you";
  const isDesktop = useIsDesktop();
  // Standing as a percentile, but only once the field is big enough for it to
  // mean anything. This is leaderboard position (score + people brought), so it
  // is labelled "Standing", never conflated with the age claim.
  const topPct =
    rank !== null && totalScored >= 10
      ? Math.max(1, Math.round((rank / totalScored) * 100))
      : null;

  return (
    <div className="surface">
      {empty ? (
        // Before the first source, the panel still has to earn the connect, so
        // it previews the outcome rather than showing a lifeless "0 · Nothing
        // yet": the ring motif the card will carry, the number waiting to move,
        // and a line about what it becomes.
        <div className="relative overflow-hidden border-b border-line p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-48 w-48"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="absolute rounded-full border border-accent"
                style={{ inset: `${i * 18}px`, opacity: 0.05 + i * 0.03 }}
              />
            ))}
          </div>
          <p className="t-label relative text-text-3">Your Patina</p>
          <div className="relative mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
            <span className="t-display text-accent" aria-label={`${score.total} out of 100`}>
              {score.total}
            </span>
            <span className="pb-2 text-lg text-text-2">Ready when you are</span>
          </div>
          <p className="relative mt-3 max-w-xs text-sm leading-relaxed text-text-3">
            Connect one account and this becomes your card — a signed score of how far back you
            really go.
          </p>
        </div>
      ) : (
        // The live card, in place of a bare number. It carries the score, the
        // verdict and the year, so nothing is lost by dropping the digits — and
        // it is the exact object the person will go on to share.
        <div className="border-b border-line p-4 sm:p-5">
          <p className="t-label px-1 pb-3 text-text-3">Your Patina</p>
          {isDesktop ? (
            <GlowCard3D username={name} score={score.total} verdict={score.verdict} year={year} years={years}>
              <PlateCard username={name} score={score.total} verdict={score.verdict} year={year} years={years} />
            </GlowCard3D>
          ) : (
            // On phones the live WebGL card is deliberately NOT mounted here.
            //
            // During a connect this tab sits in the background while the user
            // approves in the Vana tab. A running WebGL context (three.js + a
            // live GL surface) makes a phone far more likely to freeze or discard
            // the backgrounded tab under memory pressure — and a discarded tab
            // never wakes to pick up the approved data, so the Vana tab hangs on
            // "waiting for Patina" forever. Keeping this page light is what lets
            // the background poll survive and finish the connect on its own.
            //
            // Nothing is really lost: PlateCard is the same card without the 3D
            // tilt, and the live WebGL card still renders on the shareable public
            // profile (/u/[username]), which is not part of the connect flow.
            <div className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl sm:aspect-[16/10]">
              <PlateCard username={name} score={score.total} verdict={score.verdict} year={year} years={years} animate />
            </div>
          )}
        </div>
      )}

      {/*
        THE CREDENTIAL BLOCK.

        Turns the score from a quiz result into something certified. The struck
        seal — which lands like a stamp the first time it appears — says plainly
        that this is signed and checkable on Vana, the whole reason to build on a
        protocol rather than behind a login. "Standing" is the leaderboard
        percentile, kept separate from the age claim (which the rings below carry).
      */}
      {!empty && (
        <div className="border-b border-line p-6">
          <div className="flex items-center gap-4">
            <VerifiedSeal size={76} className="shrink-0 seal-strike" />
            <div className="min-w-0">
              {topPct !== null ? (
                <>
                  <p className="t-label text-text-3">Standing</p>
                  <p className="mt-1 text-2xl font-semibold text-text">
                    Top <span className="text-accent">{topPct}%</span>
                  </p>
                </>
              ) : (
                <p className="text-lg font-semibold text-text">A signed credential</p>
              )}
              <p className="mt-1.5 text-sm leading-relaxed text-text-3">
                Every Patina score is cryptographically signed on Vana.{" "}
                <a href="/verify" className="tap text-accent underline underline-offset-4">
                  Verify
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      {years !== null && years >= 1 && (
        <div className="border-b border-line p-6">
          {/* Keyed by years so the rings redraw themselves each time your history
              grows — the age claim reacting to a new connection. */}
          <DigitalRings key={years} years={years} oldestYear={year} />
        </div>
      )}

      <dl className="divide-y divide-line">
        {score.components.map((component) => {
          const pct = component.max === 0 ? 0 : (component.points / component.max) * 100;

          return (
            <div key={component.key} className="p-5 sm:px-8">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-text">{component.label}</dt>
                <dd className="t-mono text-sm text-text-2">
                  <span className="text-text">{component.points}</span>
                  <span className="text-text-4"> / {component.max}</span>
                </dd>
              </div>

              {/* Bar is decorative; the numbers above are the accessible source of truth. */}
              <div className="mt-2.5 h-[3px] w-full bg-line" aria-hidden="true">
                <div
                  className="h-full bg-accent transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }}
                />
              </div>

              <p className="mt-2.5 text-sm leading-relaxed text-text-3">{component.detail}</p>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
