"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = {
  signedIn: boolean;
  stableIdentity?: boolean;
  eligible: boolean;
  rank: number | null;
  points: number | null;
  username: string | null;
  payoutAddress: string | null;
  window: "before" | "open" | "closed";
  opensAt: string;
  closesAt: string;
  serverTime: string;
};

/**
 * The only place Patina asks for a wallet address.
 *
 * Two gates, not one: you had to be on the frozen list, and you have to be
 * inside the claim window. Both are decided by the server and merely reported
 * here, because a browser clock can be wrong or set deliberately, and neither
 * may decide whether somebody gets paid.
 *
 * The countdown below is driven by the OFFSET between the server clock and this
 * device's, worked out once on load, rather than by the device clock alone. A
 * machine an hour fast would otherwise show a window closing an hour early.
 */
export function ClaimPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  /** serverTime minus device time, so the countdown follows the server. */
  const [skew, setSkew] = useState(0);

  async function fetchStatus(): Promise<Status | null> {
    try {
      const res = await fetch("/api/patina/claim", { cache: "no-store" });
      return (await res.json()) as Status;
    } catch {
      return null;
    }
  }

  function apply(body: Status | null) {
    if (!body) {
      setError("Could not check your status. Refresh and try again.");
      return;
    }
    setSkew(Date.parse(body.serverTime) - Date.now());
    setStatus(body);
    if (body.payoutAddress) setAddress(body.payoutAddress);
  }

  async function load() {
    apply(await fetchStatus());
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      const body = await fetchStatus();
      if (alive) apply(body);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Ticks the countdown. Cheap, and stops mattering once the window closes.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/patina/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const body = await res.json();
      if (body.ok) {
        setSaved(true);
        await load();
      } else {
        setError(body.reason ?? "That did not save.");
        if (body.window) await load();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-text-3">Checking your place...</p>
      </div>
    );
  }

  const serverNow = now + skew;
  const opens = Date.parse(status.opensAt);
  const closes = Date.parse(status.closesAt);

  // Derived from the corrected clock rather than trusting the value the server
  // sent on load, so the panel flips state on its own as the window turns over.
  const live: Status["window"] =
    serverNow < opens ? "before" : serverNow >= closes ? "closed" : "open";

  const countdown = (target: number) => {
    const ms = Math.max(0, target - serverNow);
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  };

  const localWindow =
    new Date(opens).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) +
    " to " +
    new Date(closes).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  if (!status.signedIn) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-6">
        <p className="t-label text-text-3">Your claim</p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-text">
          This browser has no Patina profile.
        </h2>
        <p className="mt-2 max-w-xl leading-relaxed text-text-2">
          Open this page on the device you used, or sign in with the Google account you connected
          with. Eligibility follows your profile, not your browser.
        </p>
        <p className="mt-3 text-sm text-text-3">Claim window, your local time: {localWindow}</p>
        <Link href="/connect" className="btn btn-primary mt-5 inline-block px-6 py-3.5 text-base">
          Go to connect
        </Link>
      </div>
    );
  }

  if (!status.eligible) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-6">
        <p className="t-label text-text-3">Your claim</p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-text">
          You were not in the top {50} when the standings froze.
        </h2>
        <p className="mt-2 max-w-xl leading-relaxed text-text-2">
          Straight answer rather than a form that would never pay out. Your score is still yours and
          your card still works, there just is not a share attached to this profile.
        </p>
        {!status.stableIdentity && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-3">
            If you connected on another device and never signed in with Google, that profile is
            separate from this one. Sign in on the device you used and check there.
          </p>
        )}
      </div>
    );
  }

  const header = (
    <>
      <p className="t-label text-text-3">Your claim</p>
      <p className="mt-2 flex items-end gap-2">
        <span className="t-display text-accent">#{status.rank}</span>
        <span className="pb-2 text-lg text-text-3">of {50}</span>
      </p>
    </>
  );

  if (live === "before") {
    return (
      <div className="rounded-2xl border border-accent/40 bg-gradient-to-b from-accent-wash to-panel p-6">
        {header}
        <p className="mt-3 max-w-xl leading-relaxed text-text-2">
          You qualified{status.username ? ` as ${status.username}` : ""} with {status.points} points.
          The claim window has not opened yet.
        </p>
        <p className="t-mono mt-4 text-2xl text-accent">Opens in {countdown(opens)}</p>
        <p className="mt-2 text-sm text-text-3">Your local time: {localWindow}</p>
      </div>
    );
  }

  if (live === "closed") {
    return (
      <div className="rounded-2xl border border-line bg-panel p-6">
        {header}
        <p className="mt-3 max-w-xl leading-relaxed text-text-2">
          The claim window has closed.
        </p>
        {status.payoutAddress ? (
          <>
            <p className="mt-3 max-w-xl leading-relaxed text-accent">
              You submitted an address in time, so your claim is in.
            </p>
            <p className="t-mono mt-3 text-xs text-text-3">On file: {status.payoutAddress}</p>
          </>
        ) : (
          <p className="mt-3 max-w-xl leading-relaxed text-text-3">
            No address was submitted from this profile before the window closed, so there is nothing
            to pay out to. Saying so plainly rather than leaving a form that would go nowhere.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/40 bg-gradient-to-b from-accent-wash to-panel p-6">
      {header}
      <p className="mt-3 max-w-xl leading-relaxed text-text-2">
        You qualified{status.username ? ` as ${status.username}` : ""} with {status.points} points.
        Paste the wallet address you want your share sent to.
      </p>

      <p className="t-mono mt-4 text-lg text-accent">Window closes in {countdown(closes)}</p>
      <p className="mt-1 text-sm text-text-3">
        After that, unclaimed shares cannot be paid. Your local time: {localWindow}
      </p>
      {/*
        Repeated here, not only in the notice above, because somebody who scrolls
        straight to the form is exactly the person who needs to know that
        submitting an address does not fix an amount.
      */}
      <p className="mt-2 text-sm leading-relaxed text-text-3">
        The amount is determined solely by the builder after tax and compliance, and you will be
        told yours directly once the window closes. Submitting an address secures your place, not a
        figure.
      </p>

      <form onSubmit={submit} className="mt-5">
        <label htmlFor="addr" className="t-label text-text-3">
          Wallet address
        </label>
        <input
          id="addr"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          spellCheck={false}
          className="t-mono mt-2 w-full rounded-lg border border-line bg-bg px-4 py-3 text-sm text-text outline-none focus:border-accent"
        />

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {saved && !error && (
          <p className="mt-3 text-sm text-accent">
            Saved. You can change it until the window closes.
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !address.trim()}
          className="btn btn-primary mt-5 px-6 py-3.5 text-base disabled:opacity-50"
        >
          {busy ? "Saving..." : status.payoutAddress ? "Update address" : "Submit address"}
        </button>
      </form>

      {status.payoutAddress && (
        <p className="t-mono mt-4 text-xs text-text-3">On file: {status.payoutAddress}</p>
      )}
    </div>
  );
}
