"use client";

import { useState } from "react";
import { SourceGlyph } from "../components/SourceGlyph";
import type { ConnectPhase } from "./useConnect";
import { maturityNote, type SourceSpec } from "@/lib/sources";

/**
 * One connectable source, and the promise made before connecting it.
 *
 * THE DISCLOSURE IS THE POINT. Vana's approval page enumerates every requested
 * scope by name, so somebody connecting LinkedIn is about to read the words
 * "Connections", "Experience" and "Education" on a page that is not ours, in
 * language we did not write. If that is where they learn what we asked for, we
 * have lost them and we deserved to.
 *
 * So each scope says what it reads and what survives, in our words, first. The
 * second half of every sentence is the one that matters: "the date each of your
 * connections was made" is only reassuring next to "never names, headlines or
 * profile links".
 */

/**
 * Honest waiting copy.
 *
 * A first read genuinely takes a while, because the source is being imported in
 * Vana Desktop from scratch. A spinner labelled "Loading" for thirty seconds
 * reads as a hang and people close the tab, so the copy keeps pace with the
 * clock and says what is actually happening.
 */
function readingMessage(seconds: number): string {
  if (seconds < 6) return "Reading your history";
  if (seconds < 16) return "This is the slow part. Your history is being imported for the first time";
  if (seconds < 32) return "Still going. First imports usually take up to a minute";
  return "Nearly there. Long histories take longer, which is a good sign";
}

export function SourceCard({
  source,
  connected,
  scopesRead,
  phase,
  onStart,
  onDismissError,
  justConnected = false,
}: {
  source: SourceSpec;
  connected: boolean;
  /** How many scopes actually came back. A source can be partial and still count. */
  scopesRead?: number;
  phase: ConnectPhase;
  onStart: (source: string) => void;
  onDismissError: () => void;
  /** True for the one beat right after this source connects. Plays the pulse. */
  justConnected?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const mine = phase.type !== "idle" && phase.source === source.id;
  const busy =
    mine && (phase.type === "starting" || phase.type === "awaiting" || phase.type === "reading");
  const errored = mine && phase.type === "error";
  const otherBusy =
    !mine && (phase.type === "starting" || phase.type === "awaiting" || phase.type === "reading");

  const note = maturityNote(source.id);
  const partial = connected && scopesRead !== undefined && scopesRead < source.scopes.length;

  return (
    <div
      className={`raise border p-6 transition-colors ${!connected ? "lift" : ""} ${
        justConnected ? "just-connected" : ""
      } ${connected ? "border-accent/40 bg-accent-wash" : "border-line bg-panel"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <SourceGlyph id={source.id} connected={connected} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-semibold text-text">{source.label}</h3>
              {connected && <span className="t-label text-accent">Connected</span>}
              {!connected && source.maturity !== "stable" && (
                <span className="t-label rounded bg-panel-2 px-1.5 py-0.5 text-text-3">
                  {source.maturity === "experimental" ? "Brand new" : "Beta"}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-text-2">{source.blurb}</p>
          </div>
        </div>

        {!connected && (
          <button
            type="button"
            disabled={busy || otherBusy}
            onClick={() => onStart(source.id)}
            className="btn btn-primary shrink-0 px-5 py-2.5 text-sm"
          >
            {busy ? "Connecting..." : "Connect"}
          </button>
        )}
      </div>

      {/*
        A source that came back with only some of its scopes is not a failure,
        and should not silently look like a full one either. Somebody comparing
        their score to a friend's with the same accounts deserves to know why.
      */}
      {partial && (
        <p className="mt-3 text-sm leading-relaxed text-text-3">
          {scopesRead} of {source.scopes.length} parts came back. The rest scored nothing. You can
          reconnect later to try for the others.
        </p>
      )}

      {!connected && !busy && !errored && (
        <div className="mt-4 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setOpen((was) => !was)}
            aria-expanded={open}
            className="tap t-label text-text-3 underline-offset-4 hover:text-text hover:underline"
          >
            {open ? "Hide what Patina reads" : `What Patina reads from ${source.label}`}
          </button>

          {open && (
            <div className="sheet-up mt-4 space-y-3.5">
              {source.thirdParty && (
                <p className="border-l-2 border-warn/50 pl-3 text-sm leading-relaxed text-text-2">
                  {source.thirdParty}
                </p>
              )}

              <ul className="space-y-3">
                {source.scopes.map((scope) => (
                  <li key={scope.id}>
                    <p className="t-label text-text-3">{scope.vanaLabel}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-text-2">{scope.reads}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-accent">{scope.keeps}</p>
                  </li>
                ))}
              </ul>

              {note && <p className="text-xs leading-relaxed text-text-4">{note}</p>}
            </div>
          )}
        </div>
      )}

      {busy && (
        <div className="sheet-up mt-5 border-t border-line pt-4">
          <div className="flex items-center gap-3">
            <span
              className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
              aria-hidden="true"
            />
            <p className="text-sm text-text-2" role="status">
              {phase.type === "starting" && "Opening the Vana approval tab"}
              {phase.type === "awaiting" && "Waiting for you to approve and import in Vana"}
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

              <ol className="mt-4 space-y-1.5 text-xs leading-relaxed text-text-4">
                <li>1. On the Vana tab, choose Open in Vana Desktop.</li>
                <li>
                  2. In the app, press Import. A browser window opens and asks you to sign in to{" "}
                  {source.label}. That sign-in happens on your machine and Patina never sees it.
                </li>
                <li>3. Come back here. Keep both tabs open while it finishes.</li>
              </ol>
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
        <div className="sheet-up mt-5 border-t border-line pt-4">
          {phase.code === "SOURCE_EMPTY" ? (
            <>
              <p className="text-sm text-warn">{phase.message}</p>
              <p className="mt-2 text-xs leading-relaxed text-text-4">
                {note
                  ? note
                  : `Open Vana Desktop and check that ${source.label} finished importing. If it imported nothing, or signed in to the wrong account, run the import again and then reconnect here.`}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <a
                  href="https://app.vana.org/sources"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary px-5 py-2.5 text-sm"
                >
                  Check your sources on Vana
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
