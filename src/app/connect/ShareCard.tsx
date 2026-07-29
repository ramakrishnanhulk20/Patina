"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { ScoreView } from "./ScorePanel";
import { POINTS_PER_REFERRAL } from "@/lib/points";

/** The origin never changes, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};

/** The platform share glyph, so the button reads as the OS action it triggers. */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mr-2 h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

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

  // Read the same way as the origin, and for the same reason: it does not exist
  // during the server render, and reading it into state from an effect would
  // flash the desktop layout at every phone user for a frame.
  const canShareNatively = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
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
    if (!link) return;
    try {
      // Just the link. Every button that calls this says "link", and pasting a
      // paragraph of promo text where someone expected a URL is jarring. The
      // pitch travels with the native share sheet and the WhatsApp/Telegram/X
      // buttons, which is where a person actually wants it attached.
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Blocked outside a secure context. The field below is selectable.
    }
  }

  /**
   * The native share sheet, which on a phone beats every button below it.
   *
   * This app's entire distribution is people sending their card to someone.
   * Roughly nine in ten of them are on a phone, where the OS sheet opens on
   * their actual conversations — the WhatsApp thread they were already in —
   * rather than making them pick a network from a row of brand buttons and
   * then pick a person inside it.
   *
   * Falls back to copying, so the button is never a dead end on a desktop
   * browser without the API.
   */
  async function shareNative() {
    if (!payload) return;

    if (typeof navigator.share !== "function") {
      await copy();
      return;
    }

    try {
      await navigator.share({ title: "My Patina score", text, url: link });
    } catch (error) {
      // AbortError just means they closed the sheet, which is not a failure and
      // must not be reported as one. Anything else, fall back to the clipboard.
      if ((error as Error)?.name !== "AbortError") await copy();
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

      {/*
        One obvious action, then the rest.

        This used to be five equal buttons in a two-column grid — WhatsApp,
        Telegram, X, Copy, View — which on a phone is five decisions to make
        before sharing anything, and none of them is the one the phone already
        does better than we can.
      */}
      <div className="mt-5 space-y-2">
        {canShareNatively ? (
          <button
            type="button"
            onClick={shareNative}
            disabled={!link}
            className="btn btn-primary w-full px-5 py-3.5 text-base"
          >
            <ShareIcon />
            Share your card
          </button>
        ) : (
          <button
            type="button"
            onClick={copy}
            disabled={!link}
            className="btn btn-primary w-full px-5 py-3.5 text-base"
          >
            {copied ? "Link copied" : "Copy your link"}
          </button>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost px-3 py-2.5 text-sm"
            >
              WhatsApp
            </a>
          )}
          {telegramUrl && (
            <a
              href={telegramUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost px-3 py-2.5 text-sm"
            >
              Telegram
            </a>
          )}
          {tweetUrl && (
            <a
              href={tweetUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost px-3 py-2.5 text-sm"
            >
              X
            </a>
          )}
          {canShareNatively ? (
            <button
              type="button"
              onClick={copy}
              disabled={!link}
              className="btn btn-ghost px-3 py-2.5 text-sm"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          ) : (
            username && (
              <Link
                href={`/u/${encodeURIComponent(username)}`}
                className="btn btn-ghost px-3 py-2.5 text-sm"
              >
                View card
              </Link>
            )
          )}
        </div>

        {canShareNatively && username && (
          <Link
            href={`/u/${encodeURIComponent(username)}`}
            className="tap t-label block pt-1 text-center text-text-3 underline-offset-4 hover:text-accent hover:underline"
          >
            See what people will open
          </Link>
        )}
      </div>

      {/*
        The raw link, kept for anyone who wants to check it before sending or
        whose clipboard is blocked, but folded away rather than occupying the
        panel: it is a fallback, not the thing anyone came here to use.
      */}
      <details className="mt-4">
        <summary className="t-label cursor-pointer list-none text-text-4 [&::-webkit-details-marker]:hidden">
          Show the raw link
        </summary>
        <label className="mt-2 block">
          <span className="sr-only">Your card link</span>
          <input
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="t-mono w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-xs text-text-2"
          />
        </label>
      </details>

      <Link
        href="/rewards"
        className="tap t-label mt-4 inline-block text-text-4 underline-offset-4 transition hover:text-accent hover:underline"
      >
        How the reward works
      </Link>
    </div>
  );
}
