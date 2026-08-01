"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ScorePanel, type ScoreView } from "./ScorePanel";
import { SourceCard } from "./SourceCard";
import type { SourceSpec } from "@/lib/sources";
import { ShareCard } from "./ShareCard";
import { Identity } from "./Identity";
import { SignInPrompt } from "./SignInPrompt";
import { useConnect } from "./useConnect";
import { REWARD } from "@/lib/rewards";

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

  const connectedCount = Object.keys(readAt).length;
  const remaining = sources.length - connectedCount;
  const next = nextBestSource(new Set(Object.keys(readAt)), sources);
  const topPct =
    rank !== null && totalScored >= 10
      ? Math.max(1, Math.round((rank / totalScored) * 100))
      : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_26rem] lg:items-start lg:gap-14">
      <div>
        <h1 className="t-section text-text">
          {connectedCount === 0
            ? "Start with one."
            : "Add another. It counts for more than you think."}
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-2">
          {connectedCount === 0
            ? "Pick whichever you have had the longest. Age is what matters here, not how active you are."
            : `Each account you add is independent proof, and the score weights that heavily. ${
                remaining > 0
                  ? `${remaining} left to go.`
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
          Progress, the best next move, and where they stand — the three things
          that pull somebody from one connected source to a full profile, which
          is what the score and the leaderboard both reward.
        */}
        {connectedCount > 0 && (
          <div className="mt-6 border border-line bg-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="t-label text-text-3">
                {connectedCount} of {sources.length} connected
              </span>
              {rank !== null && (
                <span className="t-label text-text-3">
                  #{rank}
                  {topPct !== null && <span className="text-accent"> · top {topPct}%</span>}
                </span>
              )}
            </div>

            <div className="mt-3 flex gap-1.5" aria-hidden="true">
              {sources.map((source) => (
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
                Best next: <span className="font-medium text-text">{next.label}</span> — {next.reason}.
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
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              connected={Boolean(readAt[source.id])}
              locked={false}
              phase={phase}
              onStart={start}
              onDismissError={dismissError}
            />
          ))}
        </div>

        <p className="mt-8 max-w-xl text-sm leading-relaxed text-text-3">
          Each source is approved separately, because Vana asks for one at a time. Approving opens a
          Vana tab — enter your profile there, approve, and keep both tabs open until it says
          connected. That tab hands the data over; this one collects it. We never see a password,
          and you can revoke access from your Vana account whenever you want.
        </p>
      </div>

      <div className="space-y-4 lg:sticky lg:top-8">
        <ScorePanel score={score} username={username} />

        {/*
          The story sits right under the score on purpose. It is the payoff for
          connecting, and buried in a text link almost nobody found it. A big
          button here means every person who reaches a score is told, plainly,
          that there is a whole page waiting for them.
        */}
        {connectedCount > 0 && username && (
          <div>
            <Link
              href={`/u/${encodeURIComponent(username)}/story`}
              className="btn btn-primary w-full px-6 py-3.5 text-base"
            >
              See your whole story
            </Link>
            <p className="mt-2 text-center text-sm text-text-3">
              A time machine, built from your history.
            </p>
          </div>
        )}

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
  );
}
