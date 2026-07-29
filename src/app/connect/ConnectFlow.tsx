"use client";

import { useCallback, useEffect, useState } from "react";
import { ScorePanel, type ScoreView } from "./ScorePanel";
import { SourceCard } from "./SourceCard";
import type { SourceSpec } from "@/lib/sources";
import { ShareCard } from "./ShareCard";
import { Identity } from "./Identity";
import { useConnect } from "./useConnect";

export function ConnectFlow({
  sources,
  initialScore,
  initialReadAt,
  referralCode,
  referralCount,
  promptForName,
  perShareIfWin,
  initialSignedIn,
  initialUsername,
}: {
  sources: SourceSpec[];
  initialScore: ScoreView;
  initialReadAt: Record<string, string>;
  referralCode: string;
  referralCount: number;
  promptForName: boolean;
  perShareIfWin: number;
  initialSignedIn: boolean;
  initialUsername: string | null;
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
          <Identity
            signedIn={signedIn}
            username={username}
            promptForName={promptForName}
            onNamed={refresh}
          />
        </div>

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
          Vana tab: keep it and this one open together until the source says connected, since that
          tab is what hands the data over and this one is what collects it. We never see a password,
          and you can revoke access from your Vana account whenever you want.
        </p>
      </div>

      <div className="space-y-4 lg:sticky lg:top-8">
        <ScorePanel score={score} />

        {connectedCount > 0 && (
          <>
            <p className="text-sm leading-relaxed text-text-3">
              This is a snapshot taken when you connected, not a live reading, because Vana gives an
              app one look at each source.
            </p>
            {code && (
              <ShareCard
                score={score}
                referralCode={code}
                referralCount={invites}
                username={username}
                points={points}
                rank={rank}
                perShareIfWin={perShareIfWin}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
