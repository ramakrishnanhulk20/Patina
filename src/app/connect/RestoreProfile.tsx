"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDirectVanaConnect } from "@opendatalabs/vana-sdk/react";
import type { SourceSpec } from "@/lib/sources";

/**
 * "I have done this before, where has it gone?"
 *
 * A person who clears their cookies lands on an empty board and concludes their
 * evening's work is gone. It is not: Patina's identity is the user's Personal
 * Server, so any approval says who they are and brings the whole profile back.
 * That was true before this component existed and it was completely invisible,
 * which made it worth nothing.
 *
 * Two things are on offer here, and the first one is free. Approving a source
 * tells Patina which Personal Server this browser belongs to, and Patina then
 * reads NOTHING, so no fee is settled and no import has to run. The person is
 * back with their score in one approval trip.
 *
 * The picker exists because an approval has to be for something, and the
 * likeliest one to go smoothly is an account they have already connected. It is
 * a list rather than a fixed choice for that reason, not for the sake of
 * choice.
 */

type Phase =
  | { type: "closed" }
  | { type: "picking" }
  | { type: "working"; source: string }
  | { type: "done"; sources: string[]; score: number; username: string | null }
  | { type: "empty" }
  | { type: "error"; message: string };

async function jsonFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Something went wrong (${res.status})`);
  return body;
}

export function RestoreProfile({
  sources,
  onRestored,
}: {
  sources: SourceSpec[];
  onRestored: () => void | Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>({ type: "closed" });

  // Read synchronously inside the click, for the same reason useConnect does:
  // the approval tab has to open under the browser's transient activation, and
  // a state setter has not applied by then.
  const sourceRef = useRef<string | null>(null);

  const onRestoredRef = useRef(onRestored);
  useEffect(() => {
    onRestoredRef.current = onRestored;
  }, [onRestored]);

  const connect = useDirectVanaConnect({
    createRequest: async () =>
      jsonFetch(`/api/patina/restore?source=${encodeURIComponent(sourceRef.current ?? "")}`, {
        method: "POST",
      }),
    getStatus: (requestId: string) =>
      jsonFetch(`/api/vana/status?requestId=${encodeURIComponent(requestId)}`),
    // "Reading the result" here means asking who this is. Nothing is read from
    // the Personal Server, so nothing is charged for.
    readResult: (requestId: string) =>
      jsonFetch(`/api/patina/restore?requestId=${encodeURIComponent(requestId)}`),
    pollIntervalMs: 1500,
    timeoutMs: 4 * 60 * 1000,
  });

  const state = connect.state;

  useEffect(() => {
    if (state.type === "done") {
      const result = state.result as {
        restored?: boolean;
        sources?: string[];
        score?: number;
        username?: string | null;
      };
      if (result?.restored) {
        setPhase({
          type: "done",
          sources: result.sources ?? [],
          score: result.score ?? 0,
          username: result.username ?? null,
        });
        void onRestoredRef.current();
      } else {
        setPhase({ type: "empty" });
      }
      connect.reset();
      sourceRef.current = null;
    } else if (state.type === "error") {
      setPhase({ type: "error", message: state.error.message });
      connect.reset();
      sourceRef.current = null;
    }
    // connect.reset is stable; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const start = useCallback(
    (id: string) => {
      sourceRef.current = id;
      setPhase({ type: "working", source: id });
      connect.start();
    },
    [connect],
  );

  if (phase.type === "closed") {
    return (
      <button
        type="button"
        onClick={() => setPhase({ type: "picking" })}
        className="tap t-label mx-auto text-text-3 underline-offset-4 hover:text-text hover:underline"
      >
        Used Patina before? Get your profile back
      </button>
    );
  }

  return (
    <section className="border border-line bg-panel p-6">
      {phase.type === "picking" && (
        <>
          <p className="t-label text-text-3">Get your profile back</p>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-text-2">
            Your score is not tied to this browser. It is tied to your Vana account, so approving
            any source you connected before is enough to find it again. Patina reads nothing and
            you are charged nothing. Pick one you have already connected.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {sources.map((spec) => (
              <button
                key={spec.id}
                type="button"
                onClick={() => start(spec.id)}
                className="tap border border-line px-4 py-2.5 text-sm text-text-2 hover:border-accent hover:text-text"
              >
                {spec.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPhase({ type: "closed" })}
            className="tap t-label mt-5 text-text-4 underline-offset-4 hover:text-text-2 hover:underline"
          >
            Never mind
          </button>
        </>
      )}

      {phase.type === "working" && (
        <>
          <p className="t-label text-text-3">Looking you up</p>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-text-2">
            Approve on the Vana tab. Keep this tab open. Nothing is being read and nothing is being
            charged: Patina only needs to know which Vana account you are.
          </p>
          {state.type === "awaiting_approval" && state.popupBlocked && (
            <a
              href={state.request.approvalUrl}
              target="_blank"
              rel="noreferrer"
              className="tap mt-4 inline-block text-sm text-accent underline underline-offset-4"
            >
              The approval tab did not open. Open it here.
            </a>
          )}
        </>
      )}

      {phase.type === "done" && (
        <>
          <p className="t-label text-accent">Found you</p>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-text-2">
            Your profile is back, with {phase.sources.length}{" "}
            {phase.sources.length === 1 ? "source" : "sources"} and a score of {phase.score}. It was
            never gone; it was waiting on your Vana account rather than in this browser.
          </p>
        </>
      )}

      {phase.type === "empty" && (
        <>
          <p className="t-label text-text-3">Nothing to bring back</p>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-text-2">
            That Vana account has no Patina profile behind it, so there is nothing to restore. If
            you connected before, it may have been with a different Vana account. Connecting a
            source below starts a fresh one either way.
          </p>
          <button
            type="button"
            onClick={() => setPhase({ type: "closed" })}
            className="tap t-label mt-4 text-text-3 underline-offset-4 hover:text-text hover:underline"
          >
            Close
          </button>
        </>
      )}

      {phase.type === "error" && (
        <>
          <p className="t-label text-warn">That did not work</p>
          <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-text-2">{phase.message}</p>
          <button
            type="button"
            onClick={() => setPhase({ type: "picking" })}
            className="tap t-label mt-4 text-text-3 underline-offset-4 hover:text-text hover:underline"
          >
            Try again
          </button>
        </>
      )}
    </section>
  );
}
