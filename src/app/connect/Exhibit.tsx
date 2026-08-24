"use client";

import { SourceGlyph } from "../components/SourceGlyph";
import { exhibitFacts, type Exhibit as ExhibitFacts } from "@/lib/story";
import type { SourceSpec } from "@/lib/sources";

/**
 * One connected source, drawn as an exhibit rather than as a list row.
 *
 * The card's whole job is to carry its OWN evidence on its face: the year, what
 * that year is, and two or three facts underneath. A person should be able to
 * look at four of these and see, without reading a score, that the four of them
 * agree about how long they have been around. That is the argument Patina
 * makes, and the board is that argument drawn rather than asserted.
 *
 * A partial read says so. Three of four scopes is still a source, but somebody
 * comparing their board with a friend's on the same accounts deserves to know
 * why theirs looks thinner.
 */
export function Exhibit({
  spec,
  facts,
  scopesRead,
  justConnected = false,
}: {
  spec: SourceSpec;
  facts: ExhibitFacts;
  scopesRead: number;
  justConnected?: boolean;
}) {
  const partial = scopesRead > 0 && scopesRead < spec.scopes.length;
  const lines = exhibitFacts(facts);

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border border-accent/30 bg-accent-wash p-5 ${
        justConnected ? "just-connected" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <SourceGlyph id={spec.id} connected />
        <span
          className={`t-mono text-[11px] ${partial ? "text-warn" : "text-accent"}`}
          title={partial ? "Some parts of this source did not come back" : undefined}
        >
          {scopesRead} of {spec.scopes.length}
        </span>
      </div>

      <div>
        <h3 className="text-[17px] font-semibold text-text">{spec.label}</h3>

        {facts.year !== null ? (
          <>
            <p className="t-mono mt-1.5 text-2xl leading-none text-text">{facts.year}</p>
            <p className="mt-1 text-[13px] text-text-2">
              {facts.yearLabel}
              {/*
                A self-reported date is marked on the card, not just discounted
                in the maths. Somebody reading the board should be able to tell
                which of these dates a machine generated and which one a person
                typed about themselves.
              */}
              {facts.soft && <span className="text-text-4"> · self-reported</span>}
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-3">
            No opening date here, but it still counts toward the months below.
          </p>
        )}
      </div>

      {lines.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-accent/25 pt-3">
          {lines.map((line) => (
            <p key={line} className="text-[13px] leading-snug text-text-2">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
