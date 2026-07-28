"use client";

import { useState } from "react";
import type { ConnectPhase } from "./useConnect";
import { HandoffPrep } from "./HandoffPrep";
import type { SourceSpec } from "@/lib/sources";

/**
 * Honest waiting copy.
 *
 * A first read genuinely takes about half a minute, because the source is being
 * collected from scratch. A spinner labelled "Loading" for thirty seconds reads
 * as a hang and people close the tab, so the copy keeps pace with the clock and
 * says what is actually happening.
 */
function readingMessage(seconds: number): string {
  if (seconds < 6) return "Reading your history";
  if (seconds < 16) return "This is the slow part. Your history is being collected for the first time";
  if (seconds < 32) return "Still going. First reads usually take up to a minute";
  return "Nearly there. Long histories take longer, which is a good sign";
}

export function SourceCard({
  source,
  connected,
  locked,
  phase,
  onStart,
  onDismissError,
}: {
  source: SourceSpec;
  connected: boolean;
  /** Signed out. Connecting now would tie the score to this browser alone. */
  locked: boolean;
  phase: ConnectPhase;
  onStart: (source: string) => void;
  onDismissError: () => void;
}) {
  const [preparing, setPreparing] = useState(false);

  const mine = phase.type !== "idle" && phase.source === source.id;
  const busy =
    mine && (phase.type === "starting" || phase.type === "awaiting" || phase.type === "reading");
  const errored = mine && phase.type === "error";
  const otherBusy =
    !mine && (phase.type === "starting" || phase.type === "awaiting" || phase.type === "reading");

  return (
    <div
      className={`border p-6 transition-colors ${
        connected
          ? "border-accent/40 bg-accent-wash"
          : locked
            ? "border-line bg-panel opacity-55"
            : "border-line bg-panel"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-semibold text-text">{source.label}</h3>
            {connected && <span className="t-label text-accent">Connected</span>}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-text-2">{source.blurb}</p>
        </div>

        {!connected && !preparing && (
          <button
            type="button"
            disabled={busy || otherBusy || locked}
            onClick={() => setPreparing(true)}
            title={locked ? "Sign in first so your score follows you, not this browser" : undefined}
            className="btn btn-primary shrink-0 px-5 py-2.5 text-sm"
          >
            {busy ? "Connecting..." : "Connect"}
          </button>
        )}
      </div>

      {preparing && !connected && !locked && (
        <HandoffPrep
          source={source}
          busy={busy}
          onContinue={() => onStart(source.id)}
          onCancel={() => setPreparing(false)}
        />
      )}

      {busy && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="flex items-center gap-3">
            <span
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
              aria-hidden="true"
            />
            <p className="text-sm text-text-2" role="status">
              {phase.type === "starting" && "Opening the Vana approval tab"}
              {phase.type === "awaiting" && "Waiting for you to approve in the Vana tab"}
              {phase.type === "reading" && readingMessage(phase.seconds)}
            </p>
            {phase.type === "reading" && (
              <span className="t-mono ml-auto text-xs text-text-4">{phase.seconds}s</span>
            )}
          </div>

          {/*
            Both tabs have to stay open. Vana's tab is what holds the data and
            serves it to us; this tab is what asks for it. Closing either one
            stalls the whole thing, and neither page can tell you that on its
            own, so we say it here.
          */}
          {phase.type === "awaiting" && (
            <div className="mt-4">
              {phase.popupBlocked ? (
                <>
                  <p className="text-sm text-warn">
                    Your browser blocked the Vana tab from opening.
                  </p>
                  <a
                    href={phase.approvalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary mt-3 inline-block px-5 py-2.5 text-sm"
                  >
                    Open the approval page
                  </a>
                </>
              ) : (
                <a
                  href={phase.approvalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="tap text-sm text-accent underline underline-offset-4"
                >
                  Approval tab did not open? Open it here
                </a>
              )}

              <p className="mt-3 text-xs leading-relaxed text-text-4">
                Paste your link there and approve, then come back to this tab. Keep both open:
                Vana&apos;s tab hands over the data and this one collects it.
              </p>
            </div>
          )}

          {phase.type === "reading" && (
            <p className="mt-3 text-xs leading-relaxed text-text-4">
              Keep both tabs open a moment longer. Vana&apos;s tab closes itself once we confirm.
            </p>
          )}
        </div>
      )}

      {errored && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-sm text-bad">{phase.message}</p>
          <button
            type="button"
            onClick={() => {
              onDismissError();
              setPreparing(true);
            }}
            className="tap t-label mt-2 text-text-3 underline-offset-4 hover:text-text hover:underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
