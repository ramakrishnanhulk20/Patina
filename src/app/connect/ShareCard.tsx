"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { ScoreView } from "./ScorePanel";

/** The origin never changes, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};

function shareText(score: ScoreView): string {
  const year = score.oldestSignal
    ? new Date(score.oldestSignal.date).getFullYear()
    : null;

  if (year) {
    return `My digital life goes back to ${year}. Patina scored it ${score.total}/100.\n\nAnyone can make a new account. Nobody can make an old one.`;
  }
  return `Patina scored my digital history ${score.total}/100.\n\nAnyone can make a new account. Nobody can make an old one.`;
}

export function ShareCard({
  score,
  referralCode,
  referralCount,
  deviceToken,
}: {
  score: ScoreView;
  referralCode: string;
  referralCount: number;
  /** Private. Only ever rendered into the owner's own device link. */
  deviceToken: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedDevice, setCopiedDevice] = useState(false);

  // window does not exist during the server render, so the origin is read as an
  // external value with an empty server snapshot rather than being pushed into
  // state from an effect.
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );

  const link = origin ? `${origin}/?r=${referralCode}` : "";
  const text = useMemo(() => shareText(score), [score]);

  const tweetUrl = link
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`
    : "";

  async function copyDevice() {
    if (!origin || !deviceToken) return;
    try {
      await navigator.clipboard.writeText(`${origin}/d?k=${deviceToken}`);
      setCopiedDevice(true);
      setTimeout(() => setCopiedDevice(false), 2200);
    } catch {
      // Blocked outside a secure context. The field above is selectable.
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(`${text}\n\n${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard is blocked in some mobile browsers without a secure context.
      // The link sits in a selectable field below, so there is still a way out.
    }
  }

  return (
    <div className="border border-line bg-panel p-6">
      <p className="t-label text-text-3">Bring someone with you</p>

      <p className="mt-3 text-sm leading-relaxed text-text-2">
        Everyone in the top 50 gets one share of the reward. Every real person who joins through
        your link gets you another. Empty accounts count for nothing, which is rather the point.
      </p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="t-mono text-2xl text-accent">{referralCount + 1}</span>
        <span className="text-sm text-text-3">
          {referralCount === 0
            ? "share so far, just yours"
            : `shares: yours plus ${referralCount} ${referralCount === 1 ? "person" : "people"}`}
        </span>
      </div>

      <Link
        href="/rewards"
        className="tap t-label mt-3 inline-block text-text-4 underline-offset-4 transition hover:text-accent hover:underline"
      >
        How the reward works
      </Link>

      <label className="mt-5 block">
        <span className="sr-only">Your invite link</span>
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="t-mono w-full border border-line bg-bg px-3 py-2.5 text-xs text-text-2"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="btn btn-ghost px-4 py-2.5 text-sm">
          {copied ? "Copied" : "Copy link"}
        </button>
        {tweetUrl && (
          <a
            href={tweetUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary px-4 py-2.5 text-sm"
          >
            Post it
          </a>
        )}
      </div>

      {/*
        Continuing on another device.

        A profile lives in this browser, so a phone and a laptop would otherwise
        be two different people with two half-finished scores. This link is how
        one person stays one person. It is a secret, so it is kept apart from the
        invite link above and labelled as private, since the two sitting next to
        each other is exactly how somebody posts the wrong one.
      */}
      {deviceToken && origin && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="t-label text-text-3">Using another device?</p>
          <p className="mt-2 text-sm leading-relaxed text-text-2">
            Open this on your phone or laptop to carry the same score across. Some sources are
            easier to connect on one than the other.
          </p>

          <label className="mt-3 block">
            <span className="sr-only">Your private device link</span>
            <input
              readOnly
              value={`${origin}/d?k=${deviceToken}`}
              onFocus={(event) => event.currentTarget.select()}
              className="t-mono w-full border border-line bg-bg px-3 py-2.5 text-xs text-text-2"
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyDevice}
              className="btn btn-ghost px-4 py-2.5 text-sm"
            >
              {copiedDevice ? "Copied" : "Copy device link"}
            </button>
            <span className="t-label text-warn">Keep private</span>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-text-4">
            Anyone with this link gets your score, so do not post it. The invite link above is the
            one to share.
          </p>
        </div>
      )}
    </div>
  );
}
