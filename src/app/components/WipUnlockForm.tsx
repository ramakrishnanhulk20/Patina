"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Quiet admin unlock on the public WIP screen. */
export function WipUnlockForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wip-unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Wrong password");
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not unlock");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative mt-12 w-full max-w-[220px] text-left"
      autoComplete="off"
    >
      <label className="sr-only" htmlFor="wip-password">
        Admin password
      </label>
      <div className="flex gap-2">
        <input
          id="wip-password"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin"
          className="min-w-0 flex-1 rounded-md border border-line bg-panel px-3 py-2 text-sm text-text outline-none placeholder:text-text-4 focus:border-line-strong"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="shrink-0 rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-text-2 disabled:opacity-40"
        >
          Enter
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-bad">{error}</p> : null}
    </form>
  );
}
