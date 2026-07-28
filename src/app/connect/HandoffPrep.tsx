"use client";

import { useMemo, useRef, useState } from "react";
import { buildProfileUrl, type SourceSpec } from "@/lib/sources";

/**
 * The step before we hand somebody to Vana.
 *
 * Vana's approval page asks for the public URL of the account being connected.
 * Most people have never needed their own channel URL and will not find it
 * while standing in a queue on mobile data, so a large share of them simply
 * stop there. This is the single biggest drop-off in the whole funnel and it
 * happens on a page we do not control.
 *
 * So: ask for the thing they DO know, assemble the URL, and copy it to their
 * clipboard on the way out. When the box appears on the next screen, the answer
 * is already sitting in their paste buffer.
 */
export function HandoffPrep({
  source,
  onContinue,
  onCancel,
  busy,
}: {
  source: SourceSpec;
  onContinue: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const url = useMemo(() => buildProfileUrl(source, raw), [source, raw]);
  const ready = source.handle ? url.length > 0 : true;

  async function continueOn() {
    if (!ready) {
      inputRef.current?.focus();
      return;
    }

    if (url) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        // Clipboard is blocked outside a secure context and in some in-app
        // browsers. The URL stays on screen to be copied by hand, so this is a
        // downgrade rather than a dead end.
      }
    }

    onContinue();
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      {source.handle ? (
        <>
          <label className="block">
            <span className="text-sm font-medium text-text">
              What is your {source.label} handle?
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-text-3">
              {source.handle.hint}
            </span>

            <span className="mt-3 flex items-stretch overflow-hidden rounded-lg border border-line-strong bg-bg focus-within:border-accent">
              <span className="t-mono hidden shrink-0 items-center bg-panel-2 px-3 text-sm text-text-3 sm:flex">
                {source.handle.prefix}
              </span>
              <input
                ref={inputRef}
                value={raw}
                onChange={(event) => {
                  setRaw(event.target.value);
                  setCopied(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void continueOn();
                  }
                }}
                placeholder={source.handle.placeholder}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-text outline-none placeholder:text-text-4"
              />
            </span>
          </label>

          {url && (
            <p className="t-mono mt-3 break-all text-xs text-text-3">
              We will copy <span className="text-accent">{url}</span> for you
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-text">
            Vana will ask for your {source.label} profile link
          </p>
          <ol className="mt-3 space-y-1.5">
            {(source.findIt ?? []).map((step, index) => (
              <li key={step} className="flex gap-2.5 text-sm leading-relaxed text-text-2">
                <span className="t-mono shrink-0 text-accent">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={continueOn}
          disabled={busy || !ready}
          className="btn btn-primary px-5 py-2.5 text-sm"
        >
          {busy ? "Opening..." : source.handle ? "Copy and continue" : "Continue"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="tap t-label px-1 text-text-3 underline-offset-4 hover:text-text hover:underline"
        >
          Cancel
        </button>
        {copied && <span className="t-label text-accent">Copied</span>}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-text-4">
        This opens Vana in a new tab. Paste the link there, approve, then come back here. Leave both
        tabs open until it says connected.
      </p>
    </div>
  );
}
