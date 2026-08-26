"use client";

import { useState } from "react";
import { VANA_DESKTOP_DOWNLOAD } from "@/lib/device";

/**
 * What a phone gets instead of buttons it cannot finish.
 *
 * The old connect page handed every visitor the same row of source cards and
 * mentioned, in a paragraph that disappeared as soon as anything was connected,
 * that a computer would be needed. Tapping one on a phone sent the person to
 * Vana, told them to open a desktop app, and stranded them there. That was the
 * single biggest leak in the funnel and it was invisible, because a person who
 * gives up on somebody else's page is not an error anyone ever sees.
 *
 * THE JOB OF THIS SCREEN is to lose as little as possible from a visit that
 * cannot end in a score today. In order: say why, without making it sound like
 * a fault of theirs; get the link onto their computer while they still care;
 * and tell them this is temporary, because it is.
 *
 * The share sheet is first because it is the only control here that finishes
 * the job. Copying a link on a phone leaves it on that phone. The OS sheet
 * opens on the apps people actually use to send themselves things, which is
 * how a link gets from a hand to a desk.
 */
export function ContinueOnDesktop({
  connectUrl,
  hasSources,
}: {
  connectUrl: string;
  /** Somebody returning to add a source has already seen the pitch. Skip it. */
  hasSources: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(connectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Blocked outside a secure context. The address is written out below and
      // can be selected by hand, so this is never a dead end.
      setShareFailed(true);
    }
  }

  async function send() {
    if (typeof navigator.share !== "function") {
      await copy();
      return;
    }
    try {
      await navigator.share({
        title: "Patina",
        text: "Open this on my computer to connect my accounts",
        url: connectUrl,
      });
    } catch (error) {
      // Closing the sheet is not a failure and must not be reported as one.
      if ((error as Error)?.name !== "AbortError") await copy();
    }
  }

  return (
    <section className="border border-line bg-panel p-6 sm:p-8">
      <p className="t-label text-text-3">Finish this on a computer</p>

      <h2 className="t-section mt-3 max-w-[18ch] text-text">
        {hasSources ? "Adding a source needs a computer." : "This part needs a computer."}
      </h2>

      <p className="mt-4 max-w-[46ch] text-[0.97rem] leading-relaxed text-text-2">
        Connecting an account runs through <strong className="text-text">Vana Desktop</strong>, which
        opens a browser on your own machine and asks you to sign in there. That is what proves the
        account is yours, and it is why Patina never sees a password. Vana Desktop runs on Mac,
        Windows and Linux, so there is nothing to install here yet.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={send}
          className="btn btn-primary w-full px-5 py-3.5 text-base sm:w-auto"
        >
          Send this link to myself
        </button>

        <div className="flex flex-col gap-2">
          <p className="t-label text-text-4">Or open this address on your computer</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap border border-line bg-bg px-3 py-2.5 text-[0.85rem] text-text-2">
              {connectUrl}
            </code>
            <button
              type="button"
              onClick={copy}
              className="tap t-label shrink-0 border border-line px-3 py-2.5 text-text-3 hover:border-text-3 hover:text-text"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {shareFailed && (
            <p className="text-xs text-text-4">
              Copying is blocked in this browser. Select the address above instead.
            </p>
          )}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-line pt-6">
        <a
          href={VANA_DESKTOP_DOWNLOAD}
          target="_blank"
          rel="noreferrer"
          className="tap t-label text-accent underline-offset-4 hover:underline"
        >
          Get Vana Desktop, ready for when you sit down
        </a>
        <p className="max-w-[44ch] text-[0.85rem] leading-relaxed text-text-4">
          Vana has said a mobile version is coming. When it lands, this step will work from a phone
          too and nothing here will need to change.
        </p>
      </div>
    </section>
  );
}
