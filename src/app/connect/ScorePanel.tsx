"use client";

import type { Component } from "@/lib/score";

export type ScoreView = {
  total: number;
  verdict: string;
  components: Component[];
  oldestSignal: { date: string; years: number; source: string } | null;
  sourcesConnected: string[];
};

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function ScorePanel({ score }: { score: ScoreView }) {
  const empty = score.sourcesConnected.length === 0;

  return (
    <div className="border border-line bg-panel">
      <div className="border-b border-line p-6 sm:p-8">
        <p className="t-label text-text-3">Your Patina</p>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
          <span className="t-display text-accent" aria-label={`${score.total} out of 100`}>
            {score.total}
          </span>
          <span className="pb-2 text-lg text-text-2">{empty ? "Nothing yet" : score.verdict}</span>
        </div>

        {score.oldestSignal && (
          <p className="mt-4 text-lg leading-relaxed text-text-2">
            Your trail starts in{" "}
            <span className="text-text">{formatMonthYear(score.oldestSignal.date)}</span>. That is{" "}
            <span className="text-text">{score.oldestSignal.years} years</span> of history nobody
            could have manufactured.
          </p>
        )}
      </div>

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
