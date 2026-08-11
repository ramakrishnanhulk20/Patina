"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScorePanel, type ScoreView } from "./ScorePanel";
import { SourceCard } from "./SourceCard";
import type { SourceSpec } from "@/lib/sources";
import { ShareCard } from "./ShareCard";
import { Identity } from "./Identity";
import { SignInPrompt } from "./SignInPrompt";
import { NextApps } from "./NextApps";
import { useConnect } from "./useConnect";
import { REWARD } from "@/lib/rewards";
import type { EcosystemApp } from "@/lib/ecosystem";

/**
 * The source worth connecting next.
 *
 * Age and Corroboration are 60% of the score, and on the web only YouTube and
 * GitHub carry an account-opened date, so an unconnected one of those wins.
 * After that any new source adds Breadth. Null once everything is connected.
 */
function nextBestSource(
  connected: Set<string>,
  sources: SourceSpec[],
): { label: string; reason: string } | null {
  const dated = sources.find(
    (source) => (source.id === "youtube" || source.id === "github") && !connected.has(source.id),
  );
  if (dated) {
    return { label: dated.label, reason: "it proves how far back you go, the biggest part of the score" };
  }
  const other = sources.find((source) => !connected.has(source.id));
  if (other) {
    return { label: other.label, reason: "another independent account raises your breadth" };
  }
  return null;
}

export function ConnectFlow({
  sources,
  initialScore,
  initialReadAt,
  referralCode,
  referralCount,
  promptForName,
  initialSignedIn,
  initialUsername,
  loginAvailable,
  loginError,
  nextApps,
}: {
  sources: SourceSpec[];
  initialScore: ScoreView;
  initialReadAt: Record<string, string>;
  referralCode: string;
  referralCount: number;
  promptForName: boolean;
  initialSignedIn: boolean;
  initialUsername: string | null;
  loginAvailable: boolean;
  loginError: string | null;
  /**
   * The onward apps for the "counts double" panel. Fetched on the server
   * unconditionally and handed down so the panel can appear the instant the
   * first source lands, driven by client state, rather than only after a full
   * page reload re-ran the server component. Empty when the Cup API is down.
   */
  nextApps: EcosystemApp[];
}) {
  const [score, setScore] = useState(initialScore);
  const [readAt, setReadAt] = useState(initialReadAt);
  const [invites, setInvites] = useState(referralCount);
  // The profile does not exist until the first source lands, so the code is
  // minted mid-session and has to be picked up on refresh rather than only
  // arriving with the server render.
  const [code, setCode] = useState(referralCode);
  // Seeded from the server, NOT defaulted to false.
  //
  // These used to start as `false`/`null` and were only ever corrected inside
  // refresh(), which nothing called on page load. So after signing in and being
  // redirected back, the server knew who you were and the page still showed
  // "Sign in" forever, because the client never asked.
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [points, setPoints] = useState(initialScore.total);
  const [rank, setRank] = useState<number | null>(null);
  const [totalScored, setTotalScored] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const next = await fetch("/api/patina/me").then((r) => r.json());
      setScore(next);
      setReadAt(next.readAt ?? {});
      if (typeof next.referralCount === "number") setInvites(next.referralCount);
      if (typeof next.referralCode === "string") setCode(next.referralCode);
      setSignedIn(Boolean(next.signedIn));
      setUsername(next.username ?? null);
      setPoints(typeof next.points === "number" ? next.points : 0);
      setRank(typeof next.rank === "number" ? next.rank : null);
      setTotalScored(typeof next.totalScored === "number" ? next.totalScored : 0);
    } catch {
      // A failed refresh is cosmetic. The read already succeeded and is stored,
      // so a slightly stale number beats an error thrown at someone who just
      // did everything right.
    }
  }, []);

  // And confirm against the server once on mount. Belt and braces: the props
  // above already render the right thing, and this means any future drift
  // between server and client heals itself in a second instead of stranding
  // somebody on a screen that is quietly wrong.
  //
  // Deferred by a tick so the state updates land in a normal event rather than
  // synchronously during the effect, which would re-render before first paint.
  useEffect(() => {
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [refresh]);

  const { phase, start, dismissError } = useConnect(refresh);

  // A one-shot "this source just connected" flag, so its card can celebrate the
  // moment rather than silently flipping to a connected state. Captured from the
  // reading→idle transition (the success path; a failure lands on "error").
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

  const connectedCount = Object.keys(readAt).length;
  const webSources = sources.filter((source) => source.kind !== "desktop");
  const desktopSources = sources.filter((source) => source.kind === "desktop");
  const connectedWeb = webSources.filter((source) => readAt[source.id]).length;
  const webRemaining = webSources.length - connectedWeb;
  const next = nextBestSource(new Set(Object.keys(readAt)), webSources);
  const topPct =
    rank !== null && totalScored >= 10
      ? Math.max(1, Math.round((rank / totalScored) * 100))
      : null;

  return (
    <>
    <div className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:items-start lg:gap-14">
      <div>
        <h1 className="t-section text-text">
          {connectedWeb === 0
            ? "Start with one."
            : "Add another. It counts for more than you think."}
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-2">
          {connectedWeb === 0
            ? "Pick whichever you have had the longest. Age is what matters here, not how active you are."
            : `Each account you add is independent proof, and the score weights that heavily. ${
                webRemaining > 0
                  ? `${webRemaining} left to go.`
                  : "That is all of them. Nothing more to prove."
              }`}
        </p>

        <div className="mt-8">
          {signedIn ? (
            <Identity
              signedIn={signedIn}
              username={username}
              promptForName={promptForName}
              onNamed={refresh}
            />
          ) : (
            <SignInPrompt
              loginAvailable={loginAvailable}
              connected={connectedCount > 0}
              loginError={loginError}
            />
          )}
        </div>

        {/*
          Progress, the best next move, and where they stand, the three things
          that pull somebody from one connected source to a full profile, which
          is what the score and the leaderboard both reward.
        */}
        {connectedCount > 0 && (
          <div className="raise mt-6 border border-line bg-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="t-label text-text-3">
                {connectedWeb} of {webSources.length} connected
              </span>
              {rank !== null && (
                <span className="t-label text-text-3">
                  #{rank}
                  {topPct !== null && <span className="text-accent"> · top {topPct}%</span>}
                </span>
              )}
            </div>

            <div className="mt-3 flex gap-1.5" aria-hidden="true">
              {webSources.map((source) => (
                <span
                  key={source.id}
                  className={`h-1.5 flex-1 rounded-full ${
                    readAt[source.id] ? "bg-accent" : "bg-line-strong"
                  }`}
                />
              ))}
            </div>

            {next && (
              <p className="mt-3 text-sm leading-relaxed text-text-2">
                Best next: <span className="font-medium text-text">{next.label}</span>, {next.reason}.
              </p>
            )}

            {rank !== null && (
              <p className="mt-2 text-sm leading-relaxed text-text-3">
                {rank > REWARD.places
                  ? `The top ${REWARD.places} split the reward. Every real friend you bring adds 10 points and moves you up.`
                  : `You are inside the paying top ${REWARD.places}. Bringing real friends helps you hold it.`}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {webSources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              connected={Boolean(readAt[source.id])}
              locked={false}
              phase={phase}
              onStart={start}
              onDismissError={dismissError}
              justConnected={justConnected === source.id}
            />
          ))}
        </div>

        <p className="mt-8 max-w-xl text-sm leading-relaxed text-text-3">
          Each source is approved separately, because Vana asks for one at a time. Approving opens a
          Vana tab, enter your profile there, approve, and keep both tabs open until it says
          connected. That tab hands the data over; this one collects it. We never see a password,
          and you can revoke access from your Vana account whenever you want.
        </p>

        {/*
          Desktop connectors, in their own section. They need Vana's DataConnect
          app on a computer, so on a phone they are shown but not tappable (the
          connect button hides below sm). They score exactly like the web ones.
        */}
        {desktopSources.length > 0 && (
          <div className="mt-12 border-t border-line pt-8">
            <h2 className="text-xl font-semibold tracking-tight text-text">Coming soon: more sources</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-2">
              More are on the way through Vana, years of orders, rides, and games, all of it deep,
              timestamped history. Vana is still rolling them out; the moment they are available, you
              will be able to connect them here, and they will count toward your score like the rest.
            </p>

            <div className="mt-5 space-y-3">
              {desktopSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  connected={Boolean(readAt[source.id])}
                  locked={false}
                  phase={phase}
                  onStart={start}
                  onDismissError={dismissError}
                  justConnected={justConnected === source.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-20">
        {/*
          The story now lives INSIDE the score card (see ScorePanel), directly
          under the plate, so the card carries both the number and the way into
          the story rather than the two sitting apart.
        */}
        <ScorePanel score={score} username={username} rank={rank} totalScored={totalScored} />

        {connectedCount > 0 && (
          <>
            <p className="text-sm leading-relaxed text-text-3">
              This is a snapshot taken when you connected, not a live reading, because Vana gives an
              app one look at each source.
            </p>
            {code && username && (
              <div className="hidden sm:block">
                <ShareCard
                  score={score}
                  referralCode={code}
                  referralCount={invites}
                  username={username}
                  points={points}
                  rank={rank}
                />
              </div>
            )}
            {code && username && (
              <Link
                href="/share"
                className="btn btn-primary flex w-full px-6 py-3.5 text-base sm:hidden"
              >
                Share your card
              </Link>
            )}
          </>
        )}
      </div>
    </div>

    {/*
      The highest-leverage move, and now it appears the moment the first source
      lands. It used to be rendered by the server page from a connected-at-load
      snapshot, so it only showed up after a manual refresh; keying it off the
      live connected count fixes that on phone and desktop alike. `nextApps` is
      already fetched server-side, so there is nothing to load here.
    */}
    {connectedCount > 0 && nextApps.length > 0 && <NextApps apps={nextApps} />}
    </>
  );
}
