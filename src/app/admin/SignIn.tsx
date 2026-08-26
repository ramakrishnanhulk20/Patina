"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * One field, because there is one operator.
 *
 * No email, no username, no "forgot your password". The password lives in an
 * environment variable and the only recovery is to change it there, which is
 * the correct amount of machinery for a login with a single user.
 *
 * The failure message is deliberately identical whatever went wrong. Telling
 * somebody that a password was "too short" or "not set" hands them information
 * about a surface they have not proved they should know exists.
 */
export function SignIn() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      setPassword("");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-20">
      <h1 className="t-label text-text-3">Patina admin</h1>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        <label htmlFor="admin-password" className="sr-only">
          Admin password
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full border border-line bg-panel px-4 py-3 text-text outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="btn btn-primary px-5 py-3 text-base disabled:opacity-50"
        >
          {busy ? "Checking..." : "Sign in"}
        </button>
        {failed && <p className="text-sm text-bad">That did not work. Try again.</p>}
      </form>
    </main>
  );
}
