"use client";

import { useState } from "react";
import { SourceGlyph } from "../components/SourceGlyph";
import { maturityNote, type SourceSpec } from "@/lib/sources";
import type { ConnectPhase } from "./useConnect";

/**
 * A source not yet on the board: an empty frame waiting for an exhibit.
 *
 * THE DISCLOSURE IS THE POINT, and on a board it has nowhere narrow to hide.
 * Vana's approval page enumerates every requested scope by name, so somebody
 * connecting LinkedIn is about to read "Connections", "Experience" and
 * "Education" on a page that is not ours, in language we did not write. If that
 * is where they learn what we asked for, we have lost them and we deserved to.
 *
 * A four-column card cannot hold four scopes legibly, so opening the disclosure
 * makes the slot span the full board instead. That is the honest trade: the
 * explanation gets the room it needs, and the person stays on the same screen.
 */
export function OpenSlot({
  spec,
  phase,
  onStart,
  onDismissError,
  recommended = false,
  reason,
}: {
  spec: SourceSpec;
  phase: ConnectPhase;
  onStart: (source: string) => void;
  onDismissError: () => void;
  /** The one worth doing next. Gets the solid button and a line of argument. */
  recommended?: boolean;
  reason?: string;
}) {
  const [open, setOpen] = useState(false);

  const mine = phase.type !== "idle" && phase.source === spec.id;
  const busy =
    mine && (phase.type === "starting" || phase.type === "awaiting" || phase.type === "reading");
  const errored = mine && phase.type === "error";
  const otherBusy =
    !mine && (phase.type === "starting" || phase.type === "awaiting" || phase.type === "reading");

  const note = maturityNote(spec.id);
  const expanded = open || busy || errored;

  return (
    <div
      className={`flex flex-col gap-3.5 rounded-2xl border border-dashed p-5 transition-colors ${
        expanded ? "col-span-full border-line-strong bg-panel" : "border-line-strong"
      } ${recommended && !expanded ? "bg-panel" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <SourceGlyph id={spec.id} muted={!recommended} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[17px] font-semibold text-text">{spec.label}</h3>
              {recommended && <span className="t-label text-accent">Next best</span>}
              {spec.maturity !== "stable" && (
                <span className="t-label rounded bg-panel-2 px-1.5 py-0.5 text-text-3">
                  {spec.maturity === "experimental" ? "Brand new" : "Beta"}
                </span>
              )}
            </div>
            {expanded && (
              <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-text-2">{spec.blurb}</p>
            )}
          </div>
        </div>

        {expanded && (
          <button
            type="button"
            disabled={busy || otherBusy}
            onClick={() => onStart(spec.id)}
            className="btn btn-primary shrink-0 px-5 py-2.5 text-sm"
          >
            {busy ? "Connecting..." : "Connect"}
          </button>
        )}
      </div>

      {!expanded && (
        <>
          <p className="flex-grow text-[13px] leading-relaxed text-text-3">
            {recommended && reason ? reason : spec.blurb}
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={otherBusy}
              onClick={() => onStart(spec.id)}
              className={`btn w-full py-2.5 text-sm ${recommended ? "btn-primary" : "btn-ghost"}`}
            >
              Connect
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={false}
              className="tap t-label text-text-3 underline-offset-4 hover:text-text hover:underline"
            >
              What Patina reads
            </button>
          </div>
        </>
      )}

      {expanded && !busy && !errored && (
        <div className="sheet-up flex flex-col gap-4 border-t border-line pt-4">
          {spec.thirdParty && (
            <p className="max-w-[70ch] border-l-2 border-warn/50 pl-3 text-sm leading-relaxed text-text-2">
              {spec.thirdParty}
            </p>
          )}

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {spec.scopes.map((scope) => (
              <li key={scope.id}>
                <p className="t-label text-text-3">{scope.vanaLabel}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-2">{scope.reads}</p>
                <p className="mt-1 text-sm leading-relaxed text-accent">{scope.keeps}</p>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-5">
            {note && <p className="text-xs leading-relaxed text-text-4">{note}</p>}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="tap t-label ml-auto text-text-3 underline-offset-4 hover:text-text hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {busy && <ConnectProgress phase={phase} label={spec.label} />}

      {errored && phase.type === "error" && (
        <div className="sheet-up border-t border-line pt-4">
          {phase.code === "SOURCE_EMPTY" ? (
            <>
              <p className="text-sm text-warn">{phase.message}</p>
              <p className="mt-2 max-w-[70ch] text-xs leading-relaxed text-text-4">
                {note ??
                  `Open Vana Desktop and check that ${spec.label} finished importing. If it imported nothing, or signed in to the wrong account, run the import again and reconnect here.`}
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

function ConnectProgress({ phase, label }: { phase: ConnectPhase; label: string }) {
  return (
    <div className="sheet-up border-t border-line pt-4">
      <div className="flex items-center gap-3">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />
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
        serves it to us; this tab is what asks for it. Closing either one stalls
        the whole thing, and neither page can tell you that on its own.
      */}
      {phase.type === "awaiting" && (
        <div className="mt-4">
          {phase.popupBlocked ? (
            <>
              <p className="text-sm text-warn">Your browser blocked the Vana tab from opening.</p>
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

          <ol className="mt-4 flex max-w-[70ch] flex-col gap-1.5 text-xs leading-relaxed text-text-4">
            <li>1. On the Vana tab, choose Open in Vana Desktop.</li>
            <li>
              2. In the app, press Import. A browser window opens and asks you to sign in to {label}.
              That sign-in happens on your machine and Patina never sees it.
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
  );
}
