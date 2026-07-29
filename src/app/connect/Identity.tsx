"use client";

import { useState } from "react";

/**
 * Who you are, in one small panel.
 *
 * Two jobs. Signing in with Google, so a score belongs to a person rather than
 * to whichever browser they happened to open, and picking a name, so the
 * standings read like a leaderboard instead of a list of anonymous rows.
 *
 * Google's `sub` is the same on every device somebody owns, which is exactly
 * the property nothing else in this stack would give us.
 */
export function Identity({
  signedIn,
  username,
  loginAvailable,
  promptForName,
  loginError,
  onNamed,
}: {
  signedIn: boolean;
  username: string | null;
  loginAvailable: boolean;
  promptForName: boolean;
  /** Set when a sign-in attempt came back unsuccessful. */
  loginError: string | null;
  onNamed: () => void | Promise<void>;
}) {
  const [name, setName] = useState(username ?? "");
  const [editing, setEditing] = useState(promptForName && !username);
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

  if (!signedIn) {
    return (
      <div className="border border-line bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold text-text">Sign in to keep your score</p>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-text-2">
              So it follows you instead of your browser. Connect on your phone, add another source
              on your laptop, and it stays one score under one name.
            </p>
          </div>

          {loginAvailable ? (
            <a href="/api/login" className="btn btn-primary shrink-0 px-5 py-2.5 text-sm">
              Continue with Google
            </a>
          ) : (
            <span className="t-label shrink-0 text-warn">Sign-in not configured</span>
          )}
        </div>

        {/*
          A failed sign-in used to land back here silently, which is
          indistinguishable from the button doing nothing at all. Say what
          happened.
        */}
        {loginError && (
          <p className="mt-4 border-t border-line pt-4 text-sm text-bad">{loginError}</p>
        )}

        <p className="mt-4 text-xs leading-relaxed text-text-4">
          We ask Google for your account id and email, nothing else. You can still connect sources
          without signing in, but your score will only live in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-accent/40 bg-accent-wash p-5">
      {editing ? (
        <>
          <label className="block">
            <span className="font-semibold text-text">Pick a name for the standings</span>
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
          <div className="flex items-center gap-2.5">
            <span className="rings" aria-hidden="true" />
            <p className="text-sm text-text">
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
            className="tap t-label text-text-3 underline-offset-4 hover:text-text hover:underline"
          >
            {username ? "Change name" : "Pick a name"}
          </button>
        </div>
      )}
    </div>
  );
}
