"use client";

import type { Component } from "@/lib/score";
import { GlowCard3D } from "../components/GlowCard3D";
import { PlateCard } from "../components/PlateCard";

export type ScoreView = {
  total: number;
  verdict: string;
  components: Component[];
  oldestSignal: { date: string; years: number; source: string } | null;
  sourcesConnected: string[];
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
    <div className="border border-line bg-panel">
      {empty ? (
        // Nothing to render on a card yet, so the panel opens with the plain
        // number and an invitation rather than a lifeless "0" card.
        <div className="border-b border-line p-6 sm:p-8">
          <p className="t-label text-text-3">Your Patina</p>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <span className="t-display text-accent" aria-label={`${score.total} out of 100`}>
              {score.total}
            </span>
            <span className="pb-2 text-lg text-text-2">Nothing yet</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-text-3">
            Connect a source and this turns into your card — the thing you share.
          </p>
        </div>
      ) : (
        // The live card, in place of a bare number. It carries the score, the
        // verdict and the year, so nothing is lost by dropping the digits — and
        // it is the exact object the person will go on to share.
        <div className="border-b border-line p-4 sm:p-5">
          <p className="t-label px-1 pb-3 text-text-3">Your Patina</p>
          <GlowCard3D username={name} score={score.total} verdict={score.verdict} year={year} years={years}>
            <PlateCard username={name} score={score.total} verdict={score.verdict} year={year} years={years} />
          </GlowCard3D>
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
