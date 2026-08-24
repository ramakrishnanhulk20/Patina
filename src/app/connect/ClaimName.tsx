"use client";

import { useState } from "react";

/**
 * Choosing the name the public page lives at.
 *
 * Two states, and the difference between them is the product's whole position
 * on what a score means.
 *
 * PROVISIONAL. Below three sources, or fewer than two carrying dates, there is
 * a number but no credential: no public page, no badge, nothing signed. The
 * customer for a credential is whoever is checking it, and one consumed from a
 * single source is noise. Refusing to sign is how the number keeps meaning
 * something. So this panel says what is missing rather than offering a name
 * that cannot be used yet.
 *
 * SIGNABLE. Pick a name, get a page.
 */
export function ClaimName({
  username,
  promptForName,
  provisional,
  provisionalReason,
  onNamed,
}: {
  username: string | null;
  /** Arrived here from a "choose your name" link, so open the field immediately. */
  promptForName: boolean;
  provisional: boolean;
  provisionalReason: string | null;
  onNamed: () => void;
}) {
  const [editing, setEditing] = useState(promptForName && !username);
  const [value, setValue] = useState(username ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (provisional) {
    return (
      <div className="border border-line bg-panel p-6">
        <h2 className="t-label text-text-3">Not shareable yet</h2>
        <p className="mt-3 text-sm leading-relaxed text-text-2">
          {provisionalReason ?? "Connect another source to make this shareable."}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-text-4">
          A score built on one account is not worth much to anyone checking it, so Patina will not
          sign one. Your number is real either way, and it is right there.
        </p>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/patina/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok || body?.ok === false) {
        setError(body?.error ?? body?.reason ?? "That did not work. Try another.");
        return;
      }

      setEditing(false);
      onNamed();
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-line bg-panel p-6">
      <h2 className="t-label text-text-3">{username ? "Your page" : "Claim your page"}</h2>

      {username && !editing ? (
        <>
          <p className="t-mono mt-3 break-all text-sm text-text">patinadata.xyz/u/{username}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="tap t-label mt-3 text-text-3 underline-offset-4 hover:text-text hover:underline"
          >
            Change it
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-text-2">
            Pick a name and your score gets a page you can link to.
          </p>

          <div className="mt-4 flex items-center gap-0 border border-line bg-panel-2">
            <span className="t-mono shrink-0 pl-3 text-sm text-text-4">/u/</span>
            <input
              value={value}
              onChange={(event) => setValue(event.target.value.toLowerCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter" && value.trim() && !saving) void save();
              }}
              placeholder="yourname"
              autoComplete="off"
              spellCheck={false}
              maxLength={22}
              aria-label="Your page name"
              aria-invalid={error ? true : undefined}
              className="t-mono w-full bg-transparent px-1 py-2.5 text-sm text-text outline-none placeholder:text-text-4"
            />
          </div>

          {error && <p className="mt-2 text-sm text-bad">{error}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={saving || !value.trim()}
              onClick={() => void save()}
              className="btn btn-primary px-5 py-2.5 text-sm"
            >
              {saving ? "Saving..." : "Claim it"}
            </button>
            {username && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setValue(username);
                  setError(null);
                }}
                className="tap t-label text-text-3 underline-offset-4 hover:text-text hover:underline"
              >
                Cancel
              </button>
            )}
          </div>

          <p className="mt-3 text-xs leading-relaxed text-text-4">
            Letters, numbers and hyphens. Three to twenty-two characters.
          </p>
        </>
      )}
    </div>
  );
}
