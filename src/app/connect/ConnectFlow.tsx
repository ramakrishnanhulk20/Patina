"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScorePanel, type ScoreView } from "./ScorePanel";
import { SourceCard } from "./SourceCard";
import { ShareCard } from "./ShareCard";
import { ClaimName } from "./ClaimName";
import { NextApps } from "./NextApps";
import { useConnect } from "./useConnect";
import type { SourceSpec } from "@/lib/sources";
import type { EcosystemApp } from "@/lib/ecosystem";

type Connected = Record<string, { readAt: string; scopes: number }>;

/**
 * The source worth connecting next, and why.
 *
 * Age plus Continuity plus Corroboration is 70 of the 100 points, so an
 * unconnected source that carries BOTH a date and per-item timestamps wins.
 * GitHub and Steam carry the oldest dates; Spotify is the densest timestamp
 * stream in the catalogue; LinkedIn is the only source of dated vouches. After
 * those, any new source adds Breadth. Null once everything is connected.
 */
function nextBestSource(
  connected: Set<string>,
  sources: SourceSpec[],
): { label: string; reason: string } | null {
  const REASONS: Record<string, string> = {
    github: "it proves how far back you go and how steadily you showed up, which is most of the score",
    steam: "Steam accounts are usually the oldest thing anybody still has",
    spotify: "every saved track is dated, which is the cheapest way to prove you were here throughout",
    linkedin: "it is the only place that shows when other people chose to connect to you",
  };

  for (const id of ["github", "steam", "spotify", "linkedin"]) {
    if (connected.has(id)) continue;
    const source = sources.find((candidate) => candidate.id === id);
    if (source) return { label: source.label, reason: REASONS[id] };
  }

  const other = sources.find((source) => !connected.has(source.id));
  return other
    ? { label: other.label, reason: "another independent account raises your breadth" }
    : null;
}

export function ConnectFlow({
  core,
  strengthen,
  initialScore,
  initialConnected,
  initialUsername,
  promptForName,
  nextApps,
}: {
  core: SourceSpec[];
  strengthen: SourceSpec[];
  initialScore: ScoreView;
  initialConnected: Connected;
  initialUsername: string | null;
  promptForName: boolean;
  nextApps: EcosystemApp[];
}) {
  const [score, setScore] = useState(initialScore);
  const [connected, setConnected] = useState(initialConnected);
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [showStrengthen, setShowStrengthen] = useState(
    () => strengthen.some((source) => initialConnected[source.id]),
  );

  const refresh = useCallback(async () => {
    try {
      const next = await fetch("/api/patina/me").then((r) => r.json());
      setScore(next);
      setConnected(
        Object.fromEntries(
          Object.entries((next.sources ?? {}) as Record<string, { readAt: string; scopes: string[] }>).map(
            ([source, record]) => [source, { readAt: record.readAt, scopes: record.scopes.length }],
          ),
        ),
      );
      setUsername(next.username ?? null);
    } catch {
      // A failed refresh is cosmetic. The read already succeeded and is stored,
      // so a slightly stale number beats an error thrown at someone who just
      // did everything right.
    }
  }, []);

  /**
   * Confirm against the server once on mount. The props above already render
   * the right thing; this means any drift between server and client heals
   * itself in a second instead of stranding somebody on a screen that is
   * quietly wrong. Deferred by a tick so the state updates land in a normal
   * event rather than synchronously during the effect.
   */
  useEffect(() => {
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [refresh]);

  const { phase, start, dismissError } = useConnect(refresh);

  /**
   * A one-shot "this source just connected" flag, so its card can celebrate the
   * moment rather than silently flipping to a connected state. Captured from the
   * reading to idle transition, which is the success path; a failure lands on
   * "error" instead.
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
      // The first success is also the moment the rest of the manifest becomes
      // worth showing: they have seen a number now, so the ask is cheaper.
      setShowStrengthen(true);
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

  const connectedIds = new Set(Object.keys(connected));
  const coreConnected = core.filter((source) => connectedIds.has(source.id)).length;
  const coreRemaining = core.length - coreConnected;
  const next = nextBestSource(connectedIds, [...core, ...strengthen]);

  const cardFor = (source: SourceSpec) => (
    <SourceCard
      key={source.id}
      source={source}
      connected={Boolean(connected[source.id])}
      scopesRead={connected[source.id]?.scopes}
      phase={phase}
      onStart={start}
      onDismissError={dismissError}
      justConnected={justConnected === source.id}
    />
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:items-start lg:gap-14">
      <div>
        <h1 className="t-section text-text">
          {connectedIds.size === 0
            ? "Start with one."
            : "Add another. It counts for more than you think."}
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-2">
          {connectedIds.size === 0
            ? "Pick whichever you have had the longest. Age is what matters here, not how active you are."
            : coreRemaining > 0
              ? `Each account you add is independent proof, and the score weights that heavily. ${coreRemaining} of the main four left.`
              : "That is the main four. Anything below adds breadth on top."}
        </p>

        {/*
          Connecting happens on a computer, full stop. Vana Desktop runs the
          import, and it is what turns a claimed handle into a proven one. Said
          once, up front, rather than as a per-card apology.
        */}
        {connectedIds.size === 0 && (
          <div className="mt-6 border-l-2 border-accent/40 bg-panel py-3 pl-4 pr-4">
            <p className="text-sm leading-relaxed text-text-2">
              You will need <strong className="text-text">Vana Desktop</strong> on this computer.
              It signs you in to each account on your own machine, which is what proves the account
              is yours. Patina never sees a password, and Vana offers the download when you connect
              your first source.
            </p>
          </div>
        )}

        {next && connectedIds.size > 0 && (
          <p className="mt-6 text-sm leading-relaxed text-text-3">
            Next best: <strong className="text-text-2">{next.label}</strong>, because {next.reason}.
          </p>
        )}

        <div className="mt-8 grid gap-4">{core.map(cardFor)}</div>

        <div className="mt-10">
          {showStrengthen ? (
            <>
              <h2 className="t-label text-text-3">Strengthen it</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-3">
                Six more, each an independent record of ordinary time passing. None of them are
                required, and every one of them makes the score harder to fake.
              </p>
              <div className="mt-5 grid gap-4">{strengthen.map(cardFor)}</div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowStrengthen(true)}
              className="tap t-label text-text-3 underline-offset-4 hover:text-text hover:underline"
            >
              Show {strengthen.length} more sources
            </button>
          )}
        </div>

        {connectedIds.size > 0 && nextApps.length > 0 && (
          <div className="mt-14">
            <NextApps apps={nextApps} />
          </div>
        )}
      </div>

      <aside className="grid gap-6 lg:sticky lg:top-24">
        <ScorePanel score={score} username={username} />

        {connectedIds.size > 0 && (
          <ClaimName
            username={username}
            promptForName={promptForName}
            provisional={score.provisional}
            provisionalReason={score.provisionalReason}
            onNamed={refresh}
          />
        )}

        {username && !score.provisional && <ShareCard score={score} username={username} />}
      </aside>
    </div>
  );
}
