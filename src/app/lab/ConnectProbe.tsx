"use client";

import { useState } from "react";
import { useDirectVanaConnect } from "@opendatalabs/vana-sdk/react";

type SourceSpec = { id: string; label: string; scopes: string[]; blurb: string };

async function jsonFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ? `${res.status}: ${body.error}` : `${res.status} from ${path}`);
  }
  return body;
}

export function ConnectProbe({ source }: { source: SourceSpec }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const connect = useDirectVanaConnect({
    createRequest: () =>
      jsonFetch(`/api/vana/request?source=${source.id}`, { method: "POST" }),
    getStatus: (requestId: string) =>
      jsonFetch(`/api/vana/status?requestId=${encodeURIComponent(requestId)}`),
    readResult: async (requestId: string) => {
      const result = await jsonFetch(`/api/vana/data?requestId=${encodeURIComponent(requestId)}`);
      if (startedAt) setElapsed(Date.now() - startedAt);
      return result;
    },
  });

  const state = connect.state;
  const running = state.type !== "idle" && state.type !== "done" && state.type !== "error";

  const phase: Record<string, string> = {
    idle: "Ready",
    creating: "Creating access request",
    awaiting_approval: "Waiting for you to approve in the other tab",
    reading: "Reading from your Personal Server and paying the fee",
    done: "Done",
    error: "Failed",
  };

  return (
    <section className="border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{source.label}</h2>
          <p className="mt-0.5 text-sm text-neutral-400">{source.blurb}</p>
          <p className="mt-2 font-mono text-[11px] text-neutral-500">
            {source.scopes.join("  ·  ")}
          </p>
        </div>

        <button
          type="button"
          disabled={running}
          onClick={() => {
            setElapsed(null);
            setStartedAt(Date.now());
            connect.start();
          }}
          className="shrink-0 rounded-lg bg-[#3EE148] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#6CFF75] disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {running ? "Connecting..." : "Connect"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
        <span
          className={
            state.type === "done"
              ? "text-[#3EE148]"
              : state.type === "error"
                ? "text-red-400"
                : running
                  ? "text-amber-300"
                  : "text-neutral-500"
          }
        >
          {phase[state.type]}
        </span>
        {elapsed !== null && <span className="text-neutral-500">{(elapsed / 1000).toFixed(1)}s</span>}
      </div>

      {state.type === "awaiting_approval" && (
        <div className="mt-3">
          <a
            href={state.request.approvalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block border border-[#3EE148]/40 px-3 py-1.5 text-sm text-[#3EE148] underline-offset-4 hover:underline"
          >
            {state.popupBlocked
              ? "Popup was blocked. Open the approval page"
              : "Approval not open? Open it here"}
          </a>
          {state.popupBlocked && (
            <p className="mt-2 text-xs text-amber-300">
              Browser blocked the popup. This is the fallback path and it matters:
              without it the flow just hangs.
            </p>
          )}
        </div>
      )}

      {state.type === "error" && (
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
          {state.error.message}
        </pre>
      )}

      {state.type === "done" && (
        <pre className="mt-3 max-h-96 overflow-auto border border-[#3EE148]/25 bg-[#3EE148]/[0.04] p-3 text-xs text-neutral-200">
          {JSON.stringify(state.result, null, 2)}
        </pre>
      )}
    </section>
  );
}
