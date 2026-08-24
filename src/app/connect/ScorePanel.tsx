"use client";

import Link from "next/link";
import type { Component } from "@/lib/score";
import { PlateCard } from "../components/PlateCard";
import { DigitalRings } from "../components/DigitalRings";
import { VerifiedSeal } from "../components/VerifiedSeal";

export type ScoreView = {
  total: number;
  verdict: string;
  components: Component[];
  oldestSignal: { date: string; years: number; source: string } | null;
  sourcesConnected: string[];
  /** Below the signing floor: a real number, but no credential behind it yet. */
  provisional: boolean;
  provisionalReason: string | null;
};

export function ScorePanel({
  score,
  username,
}: {
  score: ScoreView;
  /** Printed on the card. Falls back to a friendly placeholder before naming. */
  username?: string | null;
}) {
  const empty = score.sourcesConnected.length === 0;
  const year = score.oldestSignal ? new Date(score.oldestSignal.date).getFullYear() : null;
  const years = score.oldestSignal ? Math.floor(score.oldestSignal.years) : null;
  const name = username && username.trim() ? username : "you";

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
            Connect one account and this becomes your card, a signed score of how far back you
            really go.
          </p>
        </div>
      ) : (
        // The live card, in place of a bare number. It carries the score, the
        // verdict and the year, so nothing is lost by dropping the digits. And
        // it is the exact object the person will go on to share.
        //
        // One card for every viewport now. The old desktop/phone split existed
        // to keep a live WebGL plate off backgrounded phone tabs during a
        // connect; that plate is long gone (see the deleted GlowCard3D), so both
        // sizes render the same plain PlateCard, wrapped in the glowing edge.
        <div className="border-b border-line p-4 sm:p-5">
          <p className="t-label px-1 pb-3 text-text-3">Your Patina</p>
          <div className="card-glow">
            <PlateCard username={name} score={score.total} verdict={score.verdict} year={year} years={years} animate />
          </div>

          {/*
            The story, made part of the card rather than a button floating below
            it. Sitting right under the plate, inside the same block, the card
            now says both things at once: this is your score, and here is the
            whole story behind it. Only once a name exists, because the story
            lives at /u/<name> and there is no page to open without one.
          */}
          {username && username.trim() && (
            <div className="px-1 pt-4">
              <Link
                href={`/u/${encodeURIComponent(username)}/story`}
                className="btn btn-primary flex w-full px-6 py-3.5 text-base"
              >
                See your whole story
              </Link>
              <p className="mt-2 text-center text-sm text-text-3">
                A time machine, built from your history.
              </p>
            </div>
          )}
        </div>
      )}

      {/*
        THE CREDENTIAL BLOCK.

        Turns the score from a quiz result into something certified. The struck
        seal, which lands like a stamp the first time it appears, says plainly
        that this is signed and checkable on Vana, the whole reason to build on a
        protocol rather than behind a login.

        There was a "Standing" percentile here, showing a position on the
        competition leaderboard. The competition is over and the leaderboard is
        gone, so the branch that rendered it could never be taken.
      */}
      {!empty && (
        <div className="border-b border-line p-6">
          <div className="flex items-center gap-4">
            <VerifiedSeal size={76} className="shrink-0 seal-strike" />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-text">A signed credential</p>
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
              grows, the age claim reacting to a new connection. */}
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

/**
 * The six components on their own, without the card, the rings or the seal.
 *
 * The evidence board puts the headline number on its own plate under the
 * exhibits, so the breakdown no longer needs to carry a score with it. It is
 * still shown in full and never summarised: a score nobody can interrogate is a
 * score nobody should trust, and "why is mine 61" has to be answerable on the
 * same screen the 61 appears on.
 */
export function Components({ score }: { score: ScoreView }) {
  return (
    <section>
      <h2 className="t-label text-text-3">Where it comes from</h2>

      <dl className="mt-5 grid gap-x-9 gap-y-6 sm:grid-cols-2">
        {score.components.map((component) => {
          const pct = component.max === 0 ? 0 : (component.points / component.max) * 100;

          return (
            <div key={component.key}>
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
    </section>
  );
}
