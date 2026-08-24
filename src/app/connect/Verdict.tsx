"use client";

import Link from "next/link";
import type { ScoreView } from "./ScorePanel";

/**
 * The lines from the exhibits down to the conclusion.
 *
 * Drawn rather than implied, because the claim Patina makes is not "here are
 * some accounts" but "these accounts, together, prove something". A grid of
 * cards above a number leaves the reader to make that connection; this makes
 * it. Solid strokes come from exhibits that are actually on the board; dashed
 * ones from slots still open, which is the argument for filling them.
 *
 * Hidden below two exhibits: one line converging on a conclusion is not a
 * convergence, it is a stalk.
 */
export function ConvergeLines({ solid, dashed }: { solid: number; dashed: number }) {
  const total = solid + dashed;
  if (solid < 2 || total === 0) return null;

  const width = 900;
  const height = 54;
  const mid = width / 2;

  // Evenly spaced origins across the board's width, so each stroke leaves from
  // roughly under the card it belongs to.
  const originFor = (index: number) => ((index + 0.5) / total) * width;

  return (
    <div className="flex justify-center" aria-hidden="true">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[54px] w-full max-w-[900px]"
        fill="none"
        preserveAspectRatio="none"
      >
        {Array.from({ length: total }, (_, index) => {
          const x = originFor(index);
          const isSolid = index < solid;
          return (
            <path
              key={index}
              d={`M ${x} 0 C ${x} ${height * 0.62}, ${mid} ${height * 0.44}, ${mid} ${height}`}
              stroke={isSolid ? "var(--accent-line)" : "var(--line)"}
              strokeWidth="1.5"
              strokeDasharray={isSolid ? undefined : "4 5"}
            />
          );
        })}
      </svg>
    </div>
  );
}

/**
 * What the exhibits add up to.
 *
 * Leads with the years rather than the score, because the years are the
 * evidence and the score is only our summary of them. Somebody should be able
 * to check the number against the cards above it.
 */
export function VerdictPlate({
  score,
  username,
  sourceCount,
}: {
  score: ScoreView;
  username: string | null;
  sourceCount: number;
}) {
  const empty = sourceCount === 0;
  const years = score.oldestSignal ? score.oldestSignal.years : null;
  const year = score.oldestSignal ? new Date(score.oldestSignal.date).getUTCFullYear() : null;

  if (empty) {
    return (
      <div className="flex justify-center">
        <div className="flex min-w-0 max-w-[640px] items-center gap-8 rounded-2xl border border-dashed border-line-strong px-11 py-6">
          <div className="text-center">
            <div className="t-display text-[52px] leading-none text-text-4">0</div>
            <div className="mt-1 text-[13px] text-text-3">Not much to go on yet</div>
          </div>
          <div className="h-12 w-px bg-line" />
          <p className="max-w-[24em] text-sm leading-relaxed text-text-3">
            Connect one account with a date on it and this becomes something you can hand to
            somebody who needs to check.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div className="surface flex flex-wrap items-center justify-center gap-x-9 gap-y-6 border-accent/30 px-10 py-6">
        <div className="text-center">
          <div className="t-display text-[62px] leading-none text-accent">{score.total}</div>
          <div className="mt-1 text-[13px] text-text-2">{score.verdict}</div>
        </div>

        <div className="hidden h-14 w-px bg-line sm:block" />

        <div className="flex max-w-[30em] flex-col gap-2">
          {years !== null ? (
            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="t-mono text-xl text-text">
                {years.toFixed(1)} {years === 1 ? "year" : "years"}
              </span>
              <span className="text-sm text-text-2">provable, back to {year}</span>
            </div>
          ) : (
            <span className="text-sm text-text-2">
              Nothing you have connected carries a date yet.
            </span>
          )}

          <p className="text-sm leading-relaxed text-text-2">
            {sourceCount >= 2
              ? `${sourceCount} unrelated platforms agree on how far back you go. Arranging that means buying an aged account on each, and they do not come in matched sets.`
              : "One account proves when you started. A second proving it separately is worth a great deal more."}
          </p>
        </div>

        <div className="flex w-full justify-center border-t border-line pt-5 sm:w-auto sm:border-0 sm:pt-0">
          {score.provisional ? (
            <p className="max-w-[22em] text-center text-[13px] leading-relaxed text-warn sm:text-left">
              {score.provisionalReason}
            </p>
          ) : username ? (
            <Link href={`/u/${encodeURIComponent(username)}`} className="btn btn-ghost px-5 py-2.5 text-sm">
              See your page
            </Link>
          ) : (
            <p className="max-w-[22em] text-center text-[13px] leading-relaxed text-text-2 sm:text-left">
              Pick a name and this gets a page anyone can check.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
