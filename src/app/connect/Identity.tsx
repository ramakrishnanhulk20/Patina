"use client";

import { useState } from "react";

/**
 * Your name on the board.
 *
 * Only ever rendered to somebody already signed in: /connect shows a sign-in
 * screen and nothing else until then, so the signed-out case does not exist
 * here. That ordering is deliberate. Connecting first would build a score
 * welded to one browser, which is how a phone and a laptop became two
 * half-finished people.
 */
export function Identity({
  signedIn,
  username,
  promptForName,
  onNamed,
}: {
  signedIn: boolean;
  username: string | null;
  /** True right after signing in, so the field opens without a second tap. */
  promptForName: boolean;
  onNamed: () => void | Promise<void>;
}) {
  const [name, setName] = useState(username ?? "");
  const [editing, setEditing] = useState((promptForName || !username) && signedIn);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      const res = await fetch("/api/patina/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      const body = await res.json();

      if (!body.ok) {
        setProblem(body.reason ?? "Could not save that.");
        return;
      }

      setEditing(false);
      await onNamed();
    } catch {
      setProblem("Could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-accent/40 bg-accent-wash p-5">
      {editing ? (
        <>
          <label className="block">
            <span className="font-semibold text-text">
              {username ? "Change your name" : "Pick a name for the standings"}
            </span>
            <span className="mt-1 block text-sm leading-relaxed text-text-2">
              This is the only thing shown publicly next to your score.
            </span>

            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setProblem(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save();
                }
              }}
              placeholder="yourname"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              className="mt-3 w-full rounded-lg border border-line-strong bg-bg px-3 py-3 text-text outline-none placeholder:text-text-4 focus:border-accent"
            />
          </label>

          {problem && <p className="mt-2 text-sm text-bad">{problem}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || name.trim().length < 3}
              className="btn btn-primary px-5 py-2.5 text-sm"
            >
              {saving ? "Saving..." : "Save name"}
            </button>
            {username && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(username);
                  setProblem(null);
                }}
                className="tap t-label px-1 text-text-3 underline-offset-4 hover:text-text hover:underline"
              >
                Cancel
              </button>
            )}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-text-4">
            3 to 20 characters. Letters, numbers and underscores.
          </p>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="rings shrink-0" aria-hidden="true" />
            <p className="truncate text-sm text-text">
              {username ? (
                <>
                  Signed in as <span className="font-semibold">{username}</span>
                </>
              ) : (
                "Signed in"
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="tap t-label shrink-0 text-text-3 underline-offset-4 hover:text-text hover:underline"
          >
            {username ? "Change name" : "Pick a name"}
          </button>
        </div>
      )}
    </div>
  );
}
