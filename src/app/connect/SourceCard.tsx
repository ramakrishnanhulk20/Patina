"use client";

import type { ConnectPhase } from "./useConnect";
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
  const mine = phase.type !== "idle" && phase.source === source.id;
  const busy =
    mine && (phase.type === "starting" || phase.type === "awaiting" || phase.type === "reading");
  const errored = mine && phase.type === "error";
  const otherBusy =
    !mine && (phase.type === "starting" || phase.type === "awaiting" || phase.type === "reading");
  // Desktop sources need Vana's DataConnect app, which a phone cannot run, so
  // the connect button only appears on larger screens.
  const desktop = source.kind === "desktop";

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
            {!connected && desktop && (
              <span className="t-label rounded bg-panel-2 px-1.5 py-0.5 text-text-3">Desktop app</span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-text-2">{source.blurb}</p>
        </div>

        {!connected && (
          <button
            type="button"
            disabled={busy || otherBusy || locked}
            onClick={() => onStart(source.id)}
            title={locked ? "Sign in first so your score follows you, not this browser" : undefined}
            className={`btn btn-primary shrink-0 px-5 py-2.5 text-sm ${desktop ? "max-sm:hidden" : ""}`}
          >
            {busy ? "Connecting..." : "Connect"}
          </button>
        )}
      </div>

      {desktop && !connected && (
        <p className="mt-3 text-sm leading-relaxed text-text-3 sm:hidden">
          Open Patina on a computer with the Vana app to connect this one.
        </p>
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
                Enter your profile on the Vana tab and approve, then come back here. Keep both tabs
                open: Vana hands over the data and this one collects it.
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
          {phase.code === "SOURCE_EMPTY" ? (
            <>
              <p className="text-sm text-warn">{phase.message}</p>
              <p className="mt-2 text-xs leading-relaxed text-text-4">
                Open your {source.label} source on Vana and take a look. If it is empty or the wrong
                account, remove it and add the right one — it has to be a public profile — then
                reconnect here.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <a
                  href={`https://app.vana.org/sources/${source.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary px-5 py-2.5 text-sm"
                >
                  Check your {source.label} on Vana
                </a>
                <button
                  type="button"
                  onClick={onDismissError}
                  className="tap t-label text-text-3 underline-offset-4 hover:text-text hover:underline"
                >
                  Reconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-bad">{phase.message}</p>
              <button
                type="button"
                onClick={onDismissError}
                className="tap t-label mt-2 text-text-3 underline-offset-4 hover:text-text hover:underline"
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
