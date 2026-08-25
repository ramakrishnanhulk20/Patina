"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Exhibit } from "./Exhibit";
import { OpenSlot } from "./OpenSlot";
import { ConvergeLines, VerdictPlate } from "./Verdict";
import { ClaimName } from "./ClaimName";
import { NextApps } from "./NextApps";
import { Components } from "./ScorePanel";
import { useConnect } from "./useConnect";
import type { ScoreView } from "./ScorePanel";
import type { SourceSpec } from "@/lib/sources";
import type { Exhibit as ExhibitFacts } from "@/lib/story";
import type { EcosystemApp } from "@/lib/ecosystem";

/**
 * The connect page as an EVIDENCE BOARD.
 *
 * Not a list of things to sign into. Each connected account is an exhibit
 * carrying its own dates on its face, the open ones are empty frames, and lines
 * run from all of them down to a single conclusion. The claim Patina makes is
 * that these accounts TOGETHER prove something no one of them proves alone, and
 * the board is that claim drawn rather than asserted.
 *
 * The layout does double duty on purpose. A first-time visitor sees a board of
 * empty frames, which reads as an invitation. Somebody returning to add a sixth
 * source sees their existing exhibits alongside the remaining gaps, and can act
 * on one without walking through anything.
 */

const REASONS: Record<string, string> = {
  github:
    "It proves how far back you go and how steadily you showed up, which is most of the score.",
  steam: "Steam accounts are usually the oldest thing anybody still has.",
  spotify:
    "Every saved track is dated, which is the cheapest way to prove you were here throughout.",
  linkedin: "The only source that shows when other people chose to connect to you.",
};

const FALLBACK_REASON = "Another independent account raises your breadth.";

/**
 * Which sources feed which component, so the recommendation can answer the
 * question the board actually raises: what is this person MISSING.
 */
const FEEDS: Record<string, string[]> = {
  vouches: ["linkedin", "steam"],
  age: ["steam", "github", "youtube"],
  corroboration: ["steam", "github", "youtube", "instagram"],
  continuity: ["spotify", "github", "instagram", "amazon"],
  depth: ["spotify", "github", "instagram"],
};

/**
 * The source worth connecting next.
 *
 * Reads the score rather than following a fixed list. A fixed list recommended
 * Spotify to somebody with GitHub and Steam already on the board, whose
 * Continuity was long since maxed and whose Vouches were zero: it was pointing
 * at the component they had already won instead of the one they had not
 * started. The right answer is whichever unconnected source feeds the emptiest
 * component, which for that person is LinkedIn by a wide margin.
 */
function nextBest(
  connected: Set<string>,
  sources: SourceSpec[],
  components: ScoreView["components"],
): SourceSpec | null {
  const available = sources.filter((source) => !connected.has(source.id));
  if (available.length === 0) return null;

  // Emptiest component first, measured as a share of its own maximum so a
  // 12-point row at zero outranks a 30-point row that is already most of the way.
  const byGap = [...components].sort(
    (a, b) => a.points / a.max - b.points / b.max,
  );

  for (const component of byGap) {
    // A component already most of the way there is not where the next source
    // should go, however big the row is.
    if (component.points / component.max > 0.8) continue;
    for (const id of FEEDS[component.key] ?? []) {
      const found = available.find((source) => source.id === id);
      if (found) return found;
    }
  }

  return available[0];
}

export function ConnectFlow({
  core,
  strengthen,
  initialScore,
  initialExhibits,
  initialScopesRead,
  initialUsername,
  promptForName,
  nextApps,
}: {
  core: SourceSpec[];
  strengthen: SourceSpec[];
  initialScore: ScoreView;
  initialExhibits: ExhibitFacts[];
  initialScopesRead: Record<string, number>;
  initialUsername: string | null;
  promptForName: boolean;
  nextApps: EcosystemApp[];
}) {
  const [score, setScore] = useState(initialScore);
  const [exhibits, setExhibits] = useState(initialExhibits);
  const [scopesRead, setScopesRead] = useState(initialScopesRead);
  const [username, setUsername] = useState<string | null>(initialUsername);
  // Closed by default. Connected sources show regardless, so opening this is
  // only ever about seeing what else is on offer.
  const [showStrengthen, setShowStrengthen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetch("/api/patina/me").then((r) => r.json());
      setScore(next);
      setExhibits(Array.isArray(next.exhibits) ? next.exhibits : []);
      setScopesRead(next.scopesRead ?? {});
      setUsername(next.username ?? null);
    } catch {
      // A failed refresh is cosmetic. The read already succeeded and is stored,
      // so a slightly stale number beats an error thrown at someone who just
      // did everything right.
    }
  }, []);

  /**
   * Confirm against the server once on mount. The props already render the
   * right thing; this means any drift between server and client heals itself in
   * a second instead of stranding somebody on a screen that is quietly wrong.
   */
  useEffect(() => {
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [refresh]);

  const { phase, start, cancel, dismissError } = useConnect(refresh);

  /**
   * A one-shot "this source just landed" flag, so its exhibit can arrive rather
   * than silently appear. Captured from the reading-to-idle transition, which is
   * the success path; a failure lands on "error" instead.
   */
  const [justConnected, setJustConnected] = useState<string | null>(null);
  const readingSourceRef = useRef<string | null>(null);
  const prevPhaseTypeRef = useRef(phase.type);
  useEffect(() => {
    const prev = prevPhaseTypeRef.current;
    prevPhaseTypeRef.current = phase.type;
    if (phase.type === "reading") {
      readingSourceRef.current = phase.source;
      return;
    }
    if (prev === "reading" && phase.type === "idle" && readingSourceRef.current) {
      const done = readingSourceRef.current;
      setJustConnected(done);
      const timer = setTimeout(
        () => setJustConnected((current) => (current === done ? null : current)),
        1600,
      );
      return () => clearTimeout(timer);
    }
    // Only the phase TYPE matters here; depending on the phase object itself
    // would re-run this on every tick of the reading counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.type]);

  const factsFor = new Map(exhibits.map((facts) => [facts.source, facts]));
  const connectedIds = new Set(exhibits.map((facts) => facts.source));

  /**
   * A connected source is ALWAYS an exhibit, whichever tier it came from.
   *
   * Collapsing the extra six used to take a connected Steam down with them, so
   * a card somebody had just earned vanished when they tidied the board. Only
   * the UNCONNECTED extras are hideable, which is also what the toggle should
   * be counting.
   */
  const onBoard = [...core, ...strengthen].filter((source) => connectedIds.has(source.id));
  const hideableStrengthen = strengthen.filter((source) => !connectedIds.has(source.id));
  const open = [
    ...core.filter((source) => !connectedIds.has(source.id)),
    ...(showStrengthen ? hideableStrengthen : []),
  ];
  const recommended = nextBest(connectedIds, [...core, ...strengthen], score.components);

  return (
    <div className="flex flex-col gap-11">

      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="flex flex-col gap-3">
          <p className="t-label text-text-3">The case for you</p>
          <h1 className="t-section max-w-[15ch] text-text">
            {onBoard.length === 0
              ? "Nothing on the board yet."
              : onBoard.length === 1
                ? "One exhibit. Add a second."
                : `${onBoard.length} exhibits, one story.`}
          </h1>
        </div>

        {onBoard.length === 0 ? (
          <div className="max-w-[24em] border-l-2 border-accent-line bg-panel py-3 pl-4 pr-4">
            <p className="text-sm leading-relaxed text-text-2">
              You will need <strong className="font-semibold text-text">Vana Desktop</strong> on this
              computer. It signs you in to each account on your own machine, which is what proves the
              account is yours. Patina never sees a password.
            </p>
          </div>
        ) : score.provisional ? (
          <div className="flex items-center gap-2.5 rounded-full border border-warn/40 px-3.5 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden="true" />
            <span className="text-[13px] text-warn">{score.provisionalReason}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-full border border-accent/40 px-3.5 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span className="text-[13px] text-accent">Signed and shareable</span>
          </div>
        )}
      </header>

      {onBoard.length === 0 && (
        <p className="max-w-[52ch] text-lg leading-relaxed text-text-2">
          Each account you connect becomes one exhibit, with its dates on the face of it. Together
          they make a case that a person has been here for years, which is the one thing nobody can
          fake in an afternoon.
        </p>
      )}

      {/* the board */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {onBoard.map((spec) => (
          <Exhibit
            key={spec.id}
            spec={spec}
            facts={factsFor.get(spec.id)!}
            scopesRead={scopesRead[spec.id] ?? spec.scopes.length}
            justConnected={justConnected === spec.id}
          />
        ))}

        {open.map((spec) => (
          <OpenSlot
            key={spec.id}
            spec={spec}
            phase={phase}
            onStart={start}
            onDismissError={dismissError}
            onCancel={cancel}
            recommended={recommended?.id === spec.id}
            reason={REASONS[spec.id] ?? FALLBACK_REASON}
          />
        ))}
      </div>

      {/*
        A toggle, not a one-way door.

        Connecting a source used to force this open and there was no way to
        close it again, so a board that had been four tidy cards became ten the
        moment anything succeeded, right at the point somebody was reading their
        new score. It opens when asked and closes the same way. Sources already
        on the board are never hidden by it, however they got there.
      */}
      {hideableStrengthen.length > 0 && (
        <button
          type="button"
          onClick={() => setShowStrengthen((was) => !was)}
          aria-expanded={showStrengthen}
          className="tap t-label mx-auto text-text-3 underline-offset-4 hover:text-text hover:underline"
        >
          {showStrengthen
            ? `Hide ${hideableStrengthen.length} more ${hideableStrengthen.length === 1 ? "source" : "sources"}`
            : `Show ${hideableStrengthen.length} more ${hideableStrengthen.length === 1 ? "source" : "sources"}`}
        </button>
      )}

      {/* what it all adds up to */}
      <div className="flex flex-col">
        <ConvergeLines solid={onBoard.length} dashed={Math.min(open.length, 4)} />
        <VerdictPlate score={score} username={username} sourceCount={onBoard.length} />
      </div>

      {onBoard.length > 0 && (
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_22rem] lg:items-start">
          <Components score={score} />
          <ClaimName
            username={username}
            promptForName={promptForName}
            provisional={score.provisional}
            provisionalReason={score.provisionalReason}
            onNamed={refresh}
          />
        </div>
      )}

      {onBoard.length > 0 && nextApps.length > 0 && (
        <div className="mx-auto w-full max-w-5xl">
          <NextApps apps={nextApps} />
        </div>
      )}
    </div>
  );
}
