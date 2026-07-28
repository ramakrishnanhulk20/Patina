"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sign in once, so one person is one profile.
 *
 * Without this, identity is the browser cookie, which means the same human on a
 * phone and a laptop is two people with two half-finished scores, two rows in
 * any ranking, and two claims on one reward share.
 *
 * Nothing is read here and nothing is charged. Vana authenticates the person
 * and returns their wallet address, which is the same on every device because
 * the same Google login produces the same embedded wallet.
 */

type Phase =
  | { type: "idle" }
  | { type: "starting" }
  | { type: "waiting"; url: string; blocked: boolean }
  | { type: "error"; message: string };

async function jsonFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Something went wrong (${res.status})`);
  return body;
}

export function SignIn({
  signedIn,
  wallet,
  onSignedIn,
}: {
  signedIn: boolean;
  wallet: string | null;
  onSignedIn: () => void | Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>({ type: "idle" });
  const stop = useRef(false);
  const onSignedInRef = useRef(onSignedIn);

  useEffect(() => {
    onSignedInRef.current = onSignedIn;
  }, [onSignedIn]);

  useEffect(() => {
    stop.current = false;
    return () => {
      stop.current = true;
    };
  }, []);

  const start = useCallback(async () => {
    // Opened synchronously inside the click, before any await. This is the only
    // reliable way past a popup blocker; opening after the network call is what
    // gets it suppressed.
    const tab = window.open("", "_blank");
    setPhase({ type: "starting" });

    try {
      const session = await jsonFetch("/api/auth/start", { method: "POST" });

      if (tab && !tab.closed) tab.location.href = session.connectUrl;
      setPhase({ type: "waiting", url: session.connectUrl, blocked: !tab || tab.closed });

      const deadline = Date.now() + 10 * 60 * 1000;

      while (!stop.current && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        if (stop.current) return;

        const status = await jsonFetch(
          `/api/auth/status?sessionId=${encodeURIComponent(session.sessionId)}`,
        );

        if (status.status === "approved") {
          if (tab && !tab.closed) tab.close();
          setPhase({ type: "idle" });
          await onSignedInRef.current();
          return;
        }

        if (status.status === "denied" || status.status === "expired") {
          setPhase({
            type: "error",
            message:
              status.status === "denied"
                ? "Sign-in was declined."
                : "That sign-in expired. Try again.",
          });
          return;
        }
      }

      if (!stop.current) {
        setPhase({ type: "error", message: "Timed out waiting for sign-in. Try again." });
      }
    } catch (error) {
      if (tab && !tab.closed) tab.close();
      setPhase({
        type: "error",
        message: error instanceof Error ? error.message : "Could not sign in.",
      });
    }
  }, []);

  if (signedIn) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 border border-accent/40 bg-accent-wash px-4 py-3">
        <span className="rings" aria-hidden="true" />
        <p className="text-sm text-text">
          Signed in{wallet ? <span className="t-mono text-text-3"> · {wallet}</span> : null}
        </p>
        <p className="w-full text-xs leading-relaxed text-text-3">
          Your score follows this account, so you can connect one source on your phone and another
          on your laptop and it all lands in the same place.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-line bg-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-text">Sign in first</p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-text-2">
            So your score is yours and not your browser&apos;s. Connect on your phone, add another
            source on your laptop, and it stays one score. Nothing is read and nothing is charged.
          </p>
        </div>

        <button
          type="button"
          onClick={start}
          disabled={phase.type === "starting" || phase.type === "waiting"}
          className="btn btn-primary shrink-0 px-5 py-2.5 text-sm"
        >
          {phase.type === "idle" || phase.type === "error" ? "Sign in with Vana" : "Waiting..."}
        </button>
      </div>

      {phase.type === "waiting" && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex items-center gap-3">
            <span
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
              aria-hidden="true"
            />
            <p className="text-sm text-text-2" role="status">
              Waiting for you to sign in on the Vana tab
            </p>
          </div>

          <a
            href={phase.url}
            target="_blank"
            rel="noreferrer"
            className={`tap mt-3 inline-block text-sm underline underline-offset-4 ${
              phase.blocked ? "text-warn" : "text-accent"
            }`}
          >
            {phase.blocked ? "Your browser blocked it. Open sign-in here" : "Tab did not open?"}
          </a>

          <p className="mt-3 text-xs leading-relaxed text-text-4">
            Google, Apple or an email code. Come back to this tab when you are done.
          </p>
        </div>
      )}

      {phase.type === "error" && (
        <p className="mt-4 border-t border-line pt-4 text-sm text-bad">{phase.message}</p>
      )}
    </div>
  );
}
