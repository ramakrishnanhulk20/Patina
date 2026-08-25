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
 * What we add here is the mobile part, in two pieces:
 *
 *  1. Switching tabs on a phone throttles timers in the backgrounded one, so
 *     polling can crawl while the user is approving. Coming back re-polls
 *     immediately instead of waiting out the interval.
 *
 *  2. Phones DISCARD backgrounded tabs under memory pressure. The SDK keeps the
 *     whole flow (requestId, poll timer) in memory, so a discard erases it: the
 *     user approves in the Vana tab, comes back, and our tab has reloaded to a
 *     blank slate with nothing left polling. Stranded after approving, and
 *     after paying. So the in-flight request is mirrored into localStorage and,
 *     on reload, we pick it back up and finish the read ourselves.
 */

export type ConnectPhase =
  | { type: "idle" }
  | { type: "starting"; source: string }
  | { type: "awaiting"; source: string; approvalUrl: string; popupBlocked: boolean }
  | { type: "reading"; source: string; seconds: number }
  | { type: "error"; source: string; message: string; code?: string };

async function jsonFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(body?.error ?? `Something went wrong (${res.status})`) as Error & {
      code?: string;
    };
    // Carry the machine-readable code (e.g. SOURCE_EMPTY) so the UI can show
    // "check your source" guidance instead of a generic error.
    if (typeof body?.code === "string") error.code = body.code;
    throw error;
  }
  return body;
}

/**
 * A connection in flight, mirrored to localStorage so a discarded tab can pick
 * it back up. Keyed once (there is only ever one connect at a time) and stamped
 * so a stale entry cannot trigger a resume long after the fact.
 */
const PENDING_KEY = "patina:v2:connect-pending";
/** Ignore a stored request older than the flow's own timeout: it cannot succeed. */
const RESUME_TTL_MS = 6 * 60 * 1000;
/** How long a resumed read waits for approval, then the data, before giving up. */
const RESUME_POLL_MS = 2 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type PendingConnect = { requestId: string; source: string; startedAt: number };

function savePending(pending: PendingConnect): void {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Private mode or a full quota. Resume is a safety net, not load-bearing.
  }
}

function loadPending(): PendingConnect | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingConnect;
    if (
      typeof parsed?.requestId === "string" &&
      typeof parsed?.source === "string" &&
      typeof parsed?.startedAt === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function clearPending(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // Ignore: see savePending.
  }
}

/**
 * Solve the invisible bot check, if the server has one switched on.
 *
 * Fetches a single-use proof-of-work challenge and solves it with plain Web
 * Crypto (no library, no widget, nothing on screen), then returns the base64
 * payload to send with the connect request. It is the open-source ALTCHA v1
 * scheme: find the number whose SHA-256(salt + number) matches the challenge.
 *
 * Returns null when ALTCHA is off server-side, or if the challenge cannot be
 * fetched, and the request then goes without a token. The server decides from
 * there: with the check on it rejects a missing token, with it off it lets the
 * request through, so this can never wrongly strand a real person.
 *
 * Runs inside the SDK's createRequest, which the SDK calls AFTER it has already
 * opened the approval tab, so the short solve never costs us the popup.
 */
async function solveAltcha(): Promise<string | null> {
  type Challenge = {
    algorithm?: string;
    challenge?: string;
    salt?: string;
    signature?: string;
    maxnumber?: number;
    configured?: boolean;
  };

  let ch: Challenge | null = null;
  for (let attempt = 0; attempt < 2 && !ch; attempt += 1) {
    if (attempt > 0) await sleep(300);
    try {
      const res = await fetch("/api/altcha/challenge", { cache: "no-store" });
      if (res.ok) ch = (await res.json()) as Challenge;
    } catch {
      // A transient network blip. Retry once, then give up and let the server decide.
    }
  }

  if (
    !ch ||
    ch.configured === false ||
    typeof ch.challenge !== "string" ||
    typeof ch.salt !== "string" ||
    typeof ch.signature !== "string"
  ) {
    return null;
  }

  const { challenge, salt, signature } = ch;
  const algorithm =
    ch.algorithm === "SHA-1" || ch.algorithm === "SHA-512" ? ch.algorithm : "SHA-256";
  const max = typeof ch.maxnumber === "number" ? ch.maxnumber : 1_000_000;
  const encoder = new TextEncoder();

  for (let n = 0; n <= max; n += 1) {
    const digest = await crypto.subtle.digest(algorithm, encoder.encode(salt + n));
    const bytes = new Uint8Array(digest);
    let hex = "";
    for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, "0");
    if (hex === challenge) {
      return btoa(JSON.stringify({ algorithm, challenge, number: n, salt, signature }));
    }
  }

  return null;
}

export function useConnect(onConnected: () => void | Promise<void>) {
  const [source, setSource] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const readingSince = useRef<number | null>(null);
  // Drives the phase while finishing a connection that was resumed from
  // localStorage after a tab discard, when the SDK flow itself is back at idle.
  const [resume, setResume] = useState<
    | { source: string; kind: "reading" }
    | { source: string; kind: "error"; message: string; code?: string }
    | null
  >(null);
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
    createRequest: async () => {
      // Solve the invisible bot check before asking the server to start a paid
      // connection. The approval tab is already open by the time the SDK calls
      // this, so the sub-second solve is masked by the tab loading Vana.
      const altcha = await solveAltcha();
      const params = new URLSearchParams({ source: sourceRef.current ?? "" });
      return jsonFetch(`/api/vana/request?${params.toString()}`, {
        method: "POST",
        headers: altcha ? { "x-altcha": altcha } : undefined,
      });
    },
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
  const resumeReading = resume?.kind === "reading";
  const showReading = isReading || resumeReading;

  /**
   * Mirror the in-flight request to storage while it is live, so a discarded
   * tab can resume it. Saved once the request exists (awaiting_approval); the
   * requestId does not change through reading, so there is no need to re-save.
   * Cleared on a terminal SDK state. Deliberately NOT cleared on idle/creating:
   * clearing on idle would wipe a just-restored entry on mount before the resume
   * effect below can read it.
   */
  useEffect(() => {
    if (state.type === "awaiting_approval") {
      savePending({
        requestId: (state.request as { requestId: string }).requestId,
        source: sourceRef.current ?? source ?? "",
        startedAt: Date.now(),
      });
    } else if (state.type === "done" || state.type === "error") {
      clearPending();
    }
  }, [state, source]);

  /**
   * Pick up a connection stranded by a tab discard.
   *
   * Runs once, on mount. If storage holds a fresh in-flight request and the SDK
   * flow has been reset to idle by the reload, we finish it ourselves: poll
   * until Vana says the read is possible, fire the read, then hand off to the
   * same onConnected refresh a normal completion uses. Times out quietly rather
   * than erroring, so an abandoned attempt does not resurface as a scary message.
   */
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;

    const pending = loadPending();
    if (!pending) return;
    if (Date.now() - pending.startedAt > RESUME_TTL_MS) {
      clearPending();
      return;
    }

    setSource(pending.source);
    setSeconds(0);
    setResume({ source: pending.source, kind: "reading" });

    void (async () => {
      const deadline = Date.now() + RESUME_POLL_MS;
      let ready = false;
      try {
        while (Date.now() < deadline) {
          let status: { status?: string };
          try {
            status = await jsonFetch(
              `/api/vana/status?requestId=${encodeURIComponent(pending.requestId)}`,
            );
          } catch {
            // Unknown or not-ours request (404/403): nothing to resume.
            clearPending();
            setResume(null);
            setSource(null);
            return;
          }
          if (status.status === "approved" || status.status === "ready_for_read") {
            ready = true;
            break;
          }
          if (
            status.status === "denied" ||
            status.status === "expired" ||
            status.status === "completed"
          ) {
            clearPending();
            setResume(null);
            setSource(null);
            return;
          }
          await sleep(1500);
        }

        if (!ready) {
          // Never approved within the window. Treat as abandoned, silently.
          clearPending();
          setResume(null);
          setSource(null);
          return;
        }

        await jsonFetch(`/api/vana/data?requestId=${encodeURIComponent(pending.requestId)}`);
        await onConnectedRef.current();
        clearPending();
        setResume(null);
        setSource(null);
      } catch (err) {
        // Approved but the read failed. This IS worth showing (e.g. an empty
        // source returns SOURCE_EMPTY, which becomes "check your source").
        clearPending();
        const e = err as Error & { code?: string };
        setResume({ source: pending.source, kind: "error", message: e.message, code: e.code });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick the "this is taking a while" counter, for a live read or a resumed one.
  useEffect(() => {
    if (!showReading) {
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
  }, [showReading]);

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
      setResume(null);
      // start() must run inside the click so the SDK can open the approval tab
      // under the browser's transient activation. Deferring it here is what
      // gets the popup blocked.
      connect.start();
    },
    [connect],
  );

  /**
   * Abandon whatever is in flight and return to idle.
   *
   * Backs both "try again" after a failure and an outright cancel, because the
   * teardown is identical: reset the SDK flow, forget the source, and drop the
   * localStorage mirror so the resume effect does not pick it up on the next
   * load.
   *
   * WHAT IT DOES NOT DO is un-approve anything on Vana's side. There is no such
   * call, and after approval the grant exists whether we read it or not.
   * Cancelling before approval costs nothing; cancelling mid-read abandons a
   * read that may already have been paid for. The UI says which is which rather
   * than pretending cancel is always free.
   */
  const cancel = useCallback(() => {
    connect.reset();
    sourceRef.current = null;
    setSource(null);
    setResume(null);
    clearPending();
  }, [connect]);

  const phase: ConnectPhase = (() => {
    // A resumed connection drives the UI while the SDK flow sits idle.
    if (resume) {
      return resume.kind === "reading"
        ? { type: "reading", source: resume.source, seconds }
        : { type: "error", source: resume.source, message: resume.message, code: resume.code };
    }

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
        return {
          type: "error",
          source: forSource,
          message: state.error.message,
          code: (state.error as { code?: string }).code,
        };
      default:
        return { type: "idle" };
    }
  })();

  // `dismissError` is the same teardown under the name the error UI uses.
  return { phase, start, cancel, dismissError: cancel };
}
