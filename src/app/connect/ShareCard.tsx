"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { ScoreView } from "./ScorePanel";

/** Keep in sync with POINTS_PER_REFERRAL in store.ts — cannot import store from a client file. */
const POINTS_PER_REFERRAL = 10;

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
}: {
  score: ScoreView;
  referralCode: string;
  referralCount: number;
  /** Leaderboard points: the Patina score plus what they have brought in. */
  points: number;
  rank: number | null;
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
   * carries their referral code, which is what earns them 10 leaderboard points
   * when the invitee clears the bar. A separate "invite link" was one link too
   * many: people posted the wrong one.
   */
  const link =
    origin && username
      ? `${origin}/u/${encodeURIComponent(username)}?r=${referralCode}`
      : origin
        ? `${origin}/?r=${referralCode}`
        : "";

  const text = useMemo(() => shareText(score), [score]);
  const payload = link ? `${text}\n\n${link}` : "";

  const tweetUrl = link
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
    : "";
  const whatsappUrl = payload
    ? `https://wa.me/?text=${encodeURIComponent(payload)}`
    : "";
  const telegramUrl = payload
    ? `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
    : "";

  async function copy() {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
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
        Your card shows how far back you go. Every real person who opens it and connects adds{" "}
        {POINTS_PER_REFERRAL} points to your standings. Points are what put you in the top 50 that
        share the reward if Patina places.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
        <div className="bg-bg p-4">
          <p className="t-label text-text-3">Your points</p>
          <p className="t-mono mt-1.5 text-3xl text-accent">{points}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-3">
            score {score.total}
            {referralCount > 0
              ? ` + ${referralCount * POINTS_PER_REFERRAL} from ${referralCount === 1 ? "1 person" : `${referralCount} people`}`
              : " · bring people to rise"}
          </p>
        </div>
        <div className="bg-bg p-4">
          <p className="t-label text-text-3">Rank</p>
          <p className="t-mono mt-1.5 text-3xl text-text">{rank !== null ? `#${rank}` : "—"}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-3">
            each real person you bring = +{POINTS_PER_REFERRAL} points
          </p>
        </div>
      </div>

      {!username && (
        <p className="mt-4 border border-warn/40 bg-warn/5 p-3 text-sm leading-relaxed text-warn">
          Pick a name above first. Your card lives at a web address, and it needs one.
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary px-5 py-3 text-sm"
          >
            WhatsApp
          </a>
        )}
        {telegramUrl && (
          <a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary px-5 py-3 text-sm"
          >
            Telegram
          </a>
        )}
        {tweetUrl && (
          <a
            href={tweetUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost px-5 py-3 text-sm"
          >
            Post on X
          </a>
        )}
        <button
          type="button"
          onClick={copy}
          disabled={!link}
          className="btn btn-ghost px-5 py-3 text-sm"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        {username && (
          <Link
            href={`/u/${encodeURIComponent(username)}`}
            className="btn btn-ghost px-5 py-3 text-sm"
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
