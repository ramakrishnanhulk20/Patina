"use client";

import { useEffect, useState } from "react";

/**
 * "Add to home screen", offered at the right moment.
 *
 * Roughly nine in ten visitors are on an Android phone, where Chrome fires
 * `beforeinstallprompt` when the app is installable. We hold that event and
 * offer a tasteful banner instead of letting the browser's own mini-infobar
 * flash by unnoticed. Dismissed once, it stays dismissed; already installed, it
 * never shows. iOS Safari does not fire the event, so nothing appears there —
 * which is correct, rather than a broken button that cannot work.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "patina:v1:install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already running as an installed app, or dismissed before — never ask.
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // Storage blocked; fall through and let the prompt show.
    }

    function onPrompt(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  function remember() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore: worst case we ask again next visit.
    }
  }

  function dismiss() {
    remember();
    setDeferred(null);
  }

  async function install() {
    const event = deferred;
    setDeferred(null);
    remember();
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // The user closed the native sheet; nothing more to do.
    }
  }

  return (
    <div
      className="fixed inset-x-3 z-50 border border-line bg-panel/95 p-4 shadow-lg backdrop-blur-md sm:inset-x-auto sm:right-4 sm:max-w-sm"
      style={{ bottom: "calc(56px + env(safe-area-inset-bottom) + 0.75rem)" }}
      role="dialog"
      aria-label="Add Patina to your home screen"
    >
      <div className="flex items-start gap-3">
        <span className="rings mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Add Patina to your home screen</p>
          <p className="mt-1 text-xs leading-relaxed text-text-3">
            Open it like an app, straight from your phone. No store, no download.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={install} className="btn btn-primary px-4 py-2 text-sm">
              Add
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="tap t-label px-2 text-text-3 underline-offset-4 hover:text-text hover:underline"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
