"use client";

import { useState } from "react";

/**
 * Self-serve erasure. Backs up the privacy promise with an actual button rather
 * than a "email us" address nobody trusts. Two steps, because erasing a history
 * somebody spent an evening connecting is not something to fire on a stray tap.
 */
export function DeleteData() {
  const [state, setState] = useState<"idle" | "confirming" | "deleting" | "done" | "error">("idle");

  async function del() {
    setState("deleting");
    try {
      const res = await fetch("/api/patina/delete", { method: "POST" });
      if (!res.ok) throw new Error("delete failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="border border-accent/40 bg-accent-wash p-5">
        <p className="text-sm leading-relaxed text-text">
          Done. Your score, connected sources and name have been deleted, and this browser has been
          reset.{" "}
          <a href="/" className="text-accent underline underline-offset-4">
            Return home
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="border border-line bg-panel p-5">
      {state === "confirming" || state === "deleting" ? (
        <>
          <p className="text-sm font-semibold text-text">Delete everything?</p>
          <p className="mt-1 text-sm leading-relaxed text-text-2">
            This permanently removes your score, your connected sources, your chosen name and the
            public page they sit on. It cannot be undone, and reconnecting later starts from
            nothing.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={del}
              disabled={state === "deleting"}
              className="btn shrink-0 border border-bad/50 bg-bad/10 px-5 py-2.5 text-sm text-bad hover:bg-bad/20"
            >
              {state === "deleting" ? "Deleting..." : "Yes, delete everything"}
            </button>
            <button
              type="button"
              onClick={() => setState("idle")}
              disabled={state === "deleting"}
              className="tap t-label px-2 text-text-3 underline-offset-4 hover:text-text hover:underline"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-text">Delete my data</p>
          <p className="mt-1 text-sm leading-relaxed text-text-2">
            Remove everything Patina holds about you, whenever you want.
          </p>
          <button
            type="button"
            onClick={() => setState("confirming")}
            className="mt-3 tap t-label text-bad underline-offset-4 hover:underline"
          >
            Delete my data
          </button>
          {state === "error" && (
            <p className="mt-2 text-sm text-bad">Something went wrong. Please try again.</p>
          )}
        </>
      )}
    </div>
  );
}
