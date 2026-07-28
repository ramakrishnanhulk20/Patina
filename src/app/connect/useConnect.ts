"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDirectVanaConnect } from "@opendatalabs/vana-sdk/react";

/**
 * The connect flow. TWO TABS, and it has to be.
 *
 * This was briefly rewritten as a same-tab redirect on the theory that popups
 * are unreliable on phones. That broke it completely, and the reason is worth
 * writing down so nobody tries it again:
 *
 *   The Vana approval tab IS the user's Personal Server. It holds the data and
 *   serves it to our backend. Our tab has to stay alive, keep polling, and fire
 *   the read; only then does Vana mark the request complete and release its tab.
 *
 *   From the builder guide: "Vana redirects the approval tab to this page after
 *   approval. The original app tab continues polling status and reads the
 *   approved data."
 *
 * Navigate our own tab away and nothing is left polling, so the read never
 * happens, so Vana's tab sits on "Delivering your data" forever. The user sees
 * a hang with no error, on a page we do not control.
 *
 * The popup concern was real but the SDK already answers it: the tab is opened
 * synchronously inside the click's transient activation, which is what gets past
 * blockers, and `popupBlocked` is reported so we can show a real link instead.
 *
 * What we add here is the mobile part. Switching tabs on a phone throttles
 * timers in the backgrounded one, so polling can crawl while the user is
 * approving. Coming back re-polls immediately instead of waiting out the
 * interval.
 */

export type ConnectPhase =
  | { type: "idle" }
  | { type: "starting"; source: string }
  | { type: "awaiting"; source: string; approvalUrl: string; popupBlocked: boolean }
  | { type: "reading"; source: string; seconds: number }
  | { type: "error"; source: string; message: string };

async function jsonFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Something went wrong (${res.status})`);
  return body;
}

export function useConnect(onConnected: () => void | Promise<void>) {
  const [source, setSource] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const readingSince = useRef<number | null>(null);
  // Kept in a ref so the completion effect does not re-run every time the
  // parent hands down a new callback identity. Assigned in an effect rather
  // than during render, which React treats as a side effect.
  const onConnectedRef = useRef(onConnected);
  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  /**
   * The source has to be readable SYNCHRONOUSLY.
   *
   * `start()` runs inside the click (it must, or the approval tab gets blocked)
   * and immediately calls `createRequest`. A state setter has not applied by
   * then, so reading state here would send the previously selected source, or
   * an empty one on the first attempt. The ref is written before start() and is
   * correct the instant it is read.
   */
  const sourceRef = useRef<string | null>(null);

  const connect = useDirectVanaConnect({
    createRequest: () =>
      jsonFetch(`/api/vana/request?source=${encodeURIComponent(sourceRef.current ?? "")}`, {
        method: "POST",
      }),
    getStatus: (requestId: string) =>
      jsonFetch(`/api/vana/status?requestId=${encodeURIComponent(requestId)}`),
    readResult: (requestId: string) =>
      jsonFetch(`/api/vana/data?requestId=${encodeURIComponent(requestId)}`),
    // A first read collects the source from scratch and can take a minute, so
    // the flow is given room rather than erroring out under a real success.
    pollIntervalMs: 1500,
    timeoutMs: 6 * 60 * 1000,
  });

  const state = connect.state;
  const isReading = state.type === "reading";
  const isDone = state.type === "done";

  // Tick the "this is taking a while" counter, started when reading begins.
  useEffect(() => {
    if (!isReading) {
      readingSince.current = null;
      return;
    }
    readingSince.current = Date.now();

    const timer = setInterval(() => {
      if (readingSince.current !== null) {
        setSeconds(Math.floor((Date.now() - readingSince.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isReading]);

  // Coming back from the Vana tab should feel instant. Mobile browsers throttle
  // timers in a backgrounded tab, so without this the user returns to a page
  // that looks stuck for another second or two at the worst possible moment.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && readingSince.current !== null) {
        setSeconds(Math.floor((Date.now() - readingSince.current) / 1000));
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!isDone) return;
    void (async () => {
      await onConnectedRef.current();
      connect.reset();
      sourceRef.current = null;
      setSource(null);
    })();
    // connect.reset is stable across renders; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone]);

  const start = useCallback(
    (next: string) => {
      sourceRef.current = next;
      setSource(next);
      setSeconds(0);
      // start() must run inside the click so the SDK can open the approval tab
      // under the browser's transient activation. Deferring it here is what
      // gets the popup blocked.
      connect.start();
    },
    [connect],
  );

  const dismissError = useCallback(() => {
    connect.reset();
    sourceRef.current = null;
    setSource(null);
  }, [connect]);

  const phase: ConnectPhase = (() => {
    const forSource = source ?? "";
    switch (state.type) {
      case "creating":
        return { type: "starting", source: forSource };
      case "awaiting_approval":
        return {
          type: "awaiting",
          source: forSource,
          approvalUrl: state.request.approvalUrl,
          popupBlocked: state.popupBlocked,
        };
      case "reading":
        return { type: "reading", source: forSource, seconds };
      case "error":
        return { type: "error", source: forSource, message: state.error.message };
      default:
        return { type: "idle" };
    }
  })();

  return { phase, start, dismissError };
}
