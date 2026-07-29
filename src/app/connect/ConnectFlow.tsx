"use client";

import { useCallback, useState } from "react";
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
  loginAvailable,
  promptForName,
}: {
  sources: SourceSpec[];
  initialScore: ScoreView;
  initialReadAt: Record<string, string>;
  referralCode: string;
  referralCount: number;
  loginAvailable: boolean;
  promptForName: boolean;
}) {
  const [score, setScore] = useState(initialScore);
  const [readAt, setReadAt] = useState(initialReadAt);
  const [invites, setInvites] = useState(referralCount);
  // The profile does not exist until the first source lands, so the code is
  // minted mid-session and has to be picked up on refresh rather than only
  // arriving with the server render.
  const [code, setCode] = useState(referralCode);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetch("/api/patina/me").then((r) => r.json());
      setScore(next);
      setReadAt(next.readAt ?? {});
      if (typeof next.referralCount === "number") setInvites(next.referralCount);
      if (typeof next.referralCode === "string") setCode(next.referralCode);
      setDeviceToken(typeof next.deviceToken === "string" ? next.deviceToken : null);
      setSignedIn(Boolean(next.signedIn));
      setUsername(next.username ?? null);
    } catch {
      // A failed refresh is cosmetic. The read already succeeded and is stored,
      // so a slightly stale number beats an error thrown at someone who just
      // did everything right.
    }
  }, []);

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
            loginAvailable={loginAvailable}
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
                deviceToken={deviceToken}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
