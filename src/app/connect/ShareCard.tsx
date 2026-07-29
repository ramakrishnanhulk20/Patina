"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { ScoreView } from "./ScorePanel";

/** The origin never changes, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};

function shareText(score: ScoreView): string {
  const year = score.oldestSignal ? new Date(score.oldestSignal.date).getFullYear() : null;

  if (year) {
    return `My digital life goes back to ${year}. Patina scored it ${score.total}/100.\n\nAnyone can make a new account. Nobody can make an old one.`;
  }
  return `Patina scored my digital history ${score.total}/100.\n\nAnyone can make a new account. Nobody can make an old one.`;
}

export function ShareCard({
  score,
  referralCode,
  referralCount,
  username,
  points,
  rank,
  perShareIfWin,
}: {
  score: ScoreView;
  referralCode: string;
  referralCount: number;
  /** Leaderboard points: the Patina score plus what they have brought in. */
  points: number;
  rank: number | null;
  /** VANA a single share is worth if Patina takes the Cup. */
  perShareIfWin: number;
  /** Needed for the card link. Without a name there is no public page to share. */
  username: string | null;
}) {
  const [copied, setCopied] = useState(false);

  // window does not exist during the server render, so the origin is read as an
  // external value with an empty server snapshot rather than pushed into state
  // from an effect.
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );

  /**
   * One link, doing both jobs.
   *
   * It opens the person's card, which is the thing worth looking at, and it
   * carries their referral code, which is the thing that earns them a share. A
   * separate "invite link" was one link too many: people posted the wrong one.
   */
  const link =
    origin && username
      ? `${origin}/u/${encodeURIComponent(username)}?r=${referralCode}`
      : origin
        ? `${origin}/?r=${referralCode}`
        : "";

  const text = useMemo(() => shareText(score), [score]);

  const tweetUrl = link
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
    : "";

  // The OS share sheet on Android and iOS. Far better than a copy button on a
  // phone: it reaches WhatsApp and Telegram, which is where this audience is.
  const canShareNatively = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  async function shareNatively() {
    try {
      await navigator.share({ title: "My Patina score", text, url: link });
    } catch {
      // Cancelling the sheet throws. Not an error worth showing.
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(`${text}\n\n${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Blocked outside a secure context. The field below is selectable.
    }
  }

  return (
    <div className="border border-line bg-panel p-5 sm:p-6">
      <p className="t-label text-text-3">Share your card</p>

      <p className="mt-3 text-sm leading-relaxed text-text-2">
        Your card shows how far back you go. Every real person who opens it and connects moves you
        up the leaderboard and adds a share of the reward. If Patina does not place, there is
        nothing to split, and the board is public so you can watch where it stands.
      </p>

      {/*
        The number, and what the number is worth.
        People act on figures they can watch move, so this shows the share count
        first and translates it, while keeping the condition attached: it is
        "if Patina wins", never "you will get".
      */}
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        <div className="bg-bg p-4">
          <p className="t-label text-text-3">Your shares</p>
          <p className="t-mono mt-1.5 text-3xl text-accent">{referralCount + 1}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-3">
            {referralCount === 0
              ? "just yours so far"
              : `yours plus ${referralCount} ${referralCount === 1 ? "person" : "people"}`}
          </p>
        </div>
        <div className="bg-bg p-4">
          <p className="t-label text-text-3">If Patina wins</p>
          <p className="t-mono mt-1.5 text-3xl text-text">
            ~{Math.round(perShareIfWin * (referralCount + 1))}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-3">VANA, split at close</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-3">
        <span>
          Points <span className="t-mono text-text">{points}</span>
        </span>
        {rank !== null && (
          <span>
            Rank <span className="t-mono text-text">#{rank}</span>
          </span>
        )}
        <span className="text-text-4">Each real person you bring adds 10 points and one share.</span>
      </div>

      {!username && (
        <p className="mt-4 border border-warn/40 bg-warn/5 p-3 text-sm leading-relaxed text-warn">
          Pick a name above first. Your card lives at a web address, and it needs one.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canShareNatively ? (
          <button
            type="button"
            onClick={shareNatively}
            disabled={!link}
            className="btn btn-primary w-full px-5 py-3 text-sm sm:w-auto"
          >
            Share
          </button>
        ) : (
          tweetUrl && (
            <a
              href={tweetUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary w-full px-5 py-3 text-sm sm:w-auto"
            >
              Post on X
            </a>
          )
        )}

        <button
          type="button"
          onClick={copy}
          disabled={!link}
          className="btn btn-ghost w-full px-5 py-3 text-sm sm:w-auto"
        >
          {copied ? "Copied" : "Copy link"}
        </button>

        {username && (
          <Link
            href={`/u/${encodeURIComponent(username)}`}
            className="btn btn-ghost w-full px-5 py-3 text-sm sm:w-auto"
          >
            View card
          </Link>
        )}
      </div>

      <label className="mt-4 block">
        <span className="sr-only">Your card link</span>
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="t-mono w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-xs text-text-2"
        />
      </label>

      <Link
        href="/rewards"
        className="tap t-label mt-4 inline-block text-text-4 underline-offset-4 transition hover:text-accent hover:underline"
      >
        How the reward works
      </Link>
    </div>
  );
}
