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
}: {
  score: ScoreView;
  referralCode: string;
  referralCount: number;
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
        Your card shows your score and how far back you go. Everyone in the top {50} gets one share
        of the reward, and every real person who joins through your card gets you another.
      </p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="t-mono text-2xl text-accent">{referralCount + 1}</span>
        <span className="text-sm text-text-3">
          {referralCount === 0
            ? "share so far, just yours"
            : `shares: yours plus ${referralCount} ${referralCount === 1 ? "person" : "people"}`}
        </span>
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
