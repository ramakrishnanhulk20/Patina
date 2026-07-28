"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The connect flow, done as a same-tab redirect rather than a popup.
 *
 * The SDK ships a two-tab helper: it opens the approval page in a popup and
 * polls for the result from the original tab. That is fine on a desktop and
 * bad on a phone, which is where most of our users will be:
 *
 *   - mobile browsers block window.open aggressively, and a blocked popup
 *     leaves the flow hanging with nothing visibly wrong
 *   - mobile browsers suspend background tabs, so the polling loop in the
 *     original tab can freeze while the user is approving in the other one
 *   - two tabs is simply not a pattern non-technical people recognise
 *
 * So we do what every "Sign in with Google" button does instead: keep a note of
 * what is in flight, navigate the current tab to the approval page, and pick up
 * where we left off when the user is sent back. sessionStorage survives the
 * round trip because it is scoped to the tab, not the page.
 */

const PENDING_KEY = "patina:pending-connect";
const POLL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;

type Pending = { requestId: string; source: string; startedAt: number };

export type ConnectPhase =
  | { type: "idle" }
  | { type: "starting"; source: string }
  | { type: "resuming"; source: string; seconds: number }
  | { type: "reading"; source: string; seconds: number }
  | { type: "error"; source: string; message: string };

function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Pending;
    if (!parsed?.requestId || !parsed?.source) return null;
    if (Date.now() - parsed.startedAt > TIMEOUT_MS) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Private-mode Safari can throw on storage access. Nothing to do here:
    // worst case the user reconnects, which is safe and costs nothing extra.
  }
}

async function jsonFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Something went wrong (${res.status})`);
  return body;
}

export function useConnect(onConnected: () => void | Promise<void>) {
  const [phase, setPhase] = useState<ConnectPhase>({ type: "idle" });
  const cancelled = useRef(false);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  /** Poll until the grant is ready, then read it. */
  const finish = useCallback(async (pending: Pending) => {
    const began = Date.now();
    const tick = () => Math.floor((Date.now() - began) / 1000);

    try {
      // Phase one: wait for the approval to register.
      for (;;) {
        if (cancelled.current) return;

        const status = await jsonFetch(
          `/api/vana/status?requestId=${encodeURIComponent(pending.requestId)}`,
        );

        if (status.status === "approved" || status.status === "ready_for_read") break;

        if (status.status === "denied" || status.status === "expired") {
          clearPending();
          setPhase({
            type: "error",
            source: pending.source,
            message:
              status.status === "denied"
                ? "That approval was declined. Nothing was read."
                : "That request expired before it was approved.",
          });
          return;
        }

        if (status.status === "completed") {
          // Already read on a previous visit. Nothing left to pay for.
          break;
        }

        if (Date.now() - began > TIMEOUT_MS) {
          clearPending();
          setPhase({
            type: "error",
            source: pending.source,
            message: "We waited five minutes and did not hear back. Try connecting again.",
          });
          return;
        }

        setPhase({ type: "resuming", source: pending.source, seconds: tick() });
        await new Promise((r) => setTimeout(r, POLL_MS));
      }

      // Phase two: the slow one. First reads collect the source from scratch.
      if (cancelled.current) return;
      setPhase({ type: "reading", source: pending.source, seconds: tick() });

      const ticker = setInterval(() => {
        if (!cancelled.current) {
          setPhase({ type: "reading", source: pending.source, seconds: tick() });
        }
      }, 1000);

      try {
        await jsonFetch(`/api/vana/data?requestId=${encodeURIComponent(pending.requestId)}`);
      } finally {
        clearInterval(ticker);
      }

      clearPending();
      if (cancelled.current) return;
      setPhase({ type: "idle" });
      await onConnectedRef.current();
    } catch (error) {
      clearPending();
      if (cancelled.current) return;
      setPhase({
        type: "error",
        source: pending.source,
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }, []);

  // Pick up an approval we were sent back from.
  //
  // Kicked off from a timer rather than straight from the effect body: the
  // first thing `finish` does is set state, and doing that synchronously during
  // an effect makes React re-render before the browser has painted the page the
  // user just landed on.
  useEffect(() => {
    cancelled.current = false;
    const pending = readPending();
    if (!pending) return;

    const kickoff = setTimeout(() => void finish(pending), 0);

    return () => {
      cancelled.current = true;
      clearTimeout(kickoff);
    };
  }, [finish]);

  const start = useCallback(async (source: string) => {
    setPhase({ type: "starting", source });

    try {
      const request = await jsonFetch(`/api/vana/request?source=${encodeURIComponent(source)}`, {
        method: "POST",
      });

      const pending: Pending = {
        requestId: request.requestId,
        source,
        startedAt: Date.now(),
      };

      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      } catch {
        // If we cannot remember it we must not navigate away, or the user will
        // approve and come back to a page that has no idea what happened.
        setPhase({
          type: "error",
          source,
          message:
            "Your browser is blocking site storage, which this needs to bring you back. Turn off private browsing, or allow storage for this site.",
        });
        return;
      }

      window.location.href = request.approvalUrl;
    } catch (error) {
      setPhase({
        type: "error",
        source,
        message: error instanceof Error ? error.message : "Could not start. Try again.",
      });
    }
  }, []);

  const dismissError = useCallback(() => setPhase({ type: "idle" }), []);

  return { phase, start, dismissError };
}
