"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  liveRank: number;
  frozenRank: number | null;
  username: string | null;
  points: number;
  score: number;
  referrals: number;
  sources: number;
  referralCode: string;
  payoutAddress: string | null;
  signedIn: boolean;
  createdAt: string;
  updatedAt: string;
};

type Payload = {
  total: number;
  snapshotTaken: boolean;
  snapshotSize: number;
  claimed: number;
  rows: Row[];
};

type SortKey = "points" | "score" | "referrals" | "sources" | "createdAt";

const day = (iso: string) => (iso ? iso.slice(0, 10) : "");

/**
 * The console.
 *
 * Filtering and sorting happen in the browser rather than as round trips: the
 * whole user base fits in memory comfortably, and an operator dragging a filter
 * should not hit the database on every keystroke.
 */
export function AdminConsole() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("points");
  const [minScore, setMinScore] = useState(0);
  const [minReferrals, setMinReferrals] = useState(0);
  const [onlyWinners, setOnlyWinners] = useState(false);
  const [onlyClaimed, setOnlyClaimed] = useState(false);
  const [onlyUnclaimed, setOnlyUnclaimed] = useState(false);

  /**
   * Kept free of state so the effect below never sets state synchronously,
   * which cascades renders. It returns the payload or null and lets the caller
   * decide what to do with it.
   */
  async function fetchUsers(): Promise<Payload | null> {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as Payload;
    } catch {
      return null;
    }
  }

  async function load() {
    const next = await fetchUsers();
    if (next) {
      setData(next);
      setError(null);
    } else {
      setError("Could not load. Your session may have expired.");
    }
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      const next = await fetchUsers();
      if (!alive) return;
      if (next) setData(next);
      else setError("Could not load. Your session may have expired.");
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function freeze() {
    const ok = window.confirm(
      "Freeze the current top 50 as the payout list? This overwrites any previous list.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      await fetch("/api/admin/snapshot", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.reload();
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.rows
      .filter((r) => {
        if (minScore && r.score < minScore) return false;
        if (minReferrals && r.referrals < minReferrals) return false;
        if (onlyWinners && r.frozenRank === null) return false;
        if (onlyClaimed && !r.payoutAddress) return false;
        if (onlyUnclaimed && r.payoutAddress) return false;
        if (!q) return true;
        return (
          (r.username ?? "").toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.referralCode.toLowerCase().includes(q) ||
          (r.payoutAddress ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        sort === "createdAt" ? a.createdAt.localeCompare(b.createdAt) : b[sort] - a[sort],
      );
  }, [data, query, sort, minScore, minReferrals, onlyWinners, onlyClaimed, onlyUnclaimed]);

  function exportCsv() {
    const head = [
      "frozenRank",
      "liveRank",
      "username",
      "points",
      "score",
      "referrals",
      "sources",
      "payoutAddress",
      "signedIn",
      "referralCode",
      "createdAt",
      "profileId",
    ];
    const quote = (value: unknown) => JSON.stringify(String(value ?? ""));
    const lines = rows.map((r) =>
      [
        r.frozenRank ?? "",
        r.liveRank,
        r.username ?? "",
        r.points,
        r.score,
        r.referrals,
        r.sources,
        r.payoutAddress ?? "",
        r.signedIn,
        r.referralCode,
        r.createdAt,
        r.id,
      ]
        .map(quote)
        .join(","),
    );

    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "patina-users-" + new Date().toISOString().slice(0, 10) + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-20 sm:px-6">
        <p className="text-text-2">{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary mt-5 px-6 py-3">
          Reload
        </button>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-2xl px-5 py-20 sm:px-6">
        <p className="text-text-3">Loading...</p>
      </main>
    );
  }

  const stats: [string, string][] = [
    ["Scored profiles", data.total.toLocaleString()],
    ["Payout list", data.snapshotTaken ? data.snapshotSize + " frozen" : "not frozen"],
    ["Addresses in", String(data.claimed)],
    ["Showing", String(rows.length)],
  ];

  const toggles: [string, boolean, (v: boolean) => void][] = [
    ["Winners only", onlyWinners, setOnlyWinners],
    ["Has wallet", onlyClaimed, setOnlyClaimed],
    ["Missing wallet", onlyUnclaimed, setOnlyUnclaimed],
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="t-section text-text">Admin</h1>
        <button onClick={signOut} className="btn btn-ghost px-4 py-2 text-sm">
          Sign out
        </button>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-panel p-4">
            <dt className="t-label text-text-3">{label}</dt>
            <dd className="t-mono mt-1.5 text-xl text-text">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={freeze}
          disabled={busy}
          className="btn btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
        >
          {data.snapshotTaken ? "Re-freeze top 50" : "Freeze top 50 as payout list"}
        </button>
        <button onClick={exportCsv} className="btn btn-ghost px-5 py-2.5 text-sm">
          Export CSV
        </button>
        <button onClick={() => void load()} className="btn btn-ghost px-5 py-2.5 text-sm">
          Refresh
        </button>
      </div>

      <div className="mt-6 grid gap-3 rounded-lg border border-line bg-panel p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="t-label text-text-3">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="name, code, wallet, id"
            className="mt-1.5 w-full rounded border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="t-label text-text-3">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="mt-1.5 w-full rounded border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          >
            <option value="points">Points</option>
            <option value="score">Score</option>
            <option value="referrals">Referrals</option>
            <option value="sources">Sources</option>
            <option value="createdAt">Joined, oldest first</option>
          </select>
        </label>

        <label className="block">
          <span className="t-label text-text-3">Min score</span>
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value) || 0)}
            className="mt-1.5 w-full rounded border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="t-label text-text-3">Min referrals</span>
          <input
            type="number"
            value={minReferrals}
            onChange={(e) => setMinReferrals(Number(e.target.value) || 0)}
            className="mt-1.5 w-full rounded border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
          />
        </label>

        <div className="flex flex-wrap gap-4 sm:col-span-2 lg:col-span-4">
          {toggles.map(([label, value, set]) => (
            <label key={label} className="flex items-center gap-2 text-sm text-text-2">
              <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              {["#", "Frozen", "Who", "Points", "Score", "Refs", "Src", "Wallet", "Joined"].map(
                (h) => (
                  <th key={h} className="t-label whitespace-nowrap p-3 font-medium text-text-3">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={
                  "border-b border-line last:border-b-0 " + (r.frozenRank ? "bg-accent-wash" : "")
                }
              >
                <td className="t-mono p-3 text-text-3">{i + 1}</td>
                <td className="t-mono p-3 text-accent">{r.frozenRank ?? ""}</td>
                <td className="p-3">
                  <span className={r.username ? "font-semibold text-text" : "text-text-4"}>
                    {r.username ?? "anonymous"}
                  </span>
                  {r.signedIn && <span className="t-label ml-2 text-text-4">google</span>}
                </td>
                <td className="t-mono p-3 text-text">{r.points}</td>
                <td className="t-mono p-3 text-text-2">{r.score}</td>
                <td className="t-mono p-3 text-text-2">{r.referrals}</td>
                <td className="t-mono p-3 text-text-2">{r.sources}</td>
                <td className="t-mono p-3 text-xs">
                  {r.payoutAddress ? (
                    <span className="text-accent">{r.payoutAddress}</span>
                  ) : (
                    <span className="text-text-4">none</span>
                  )}
                </td>
                <td className="t-mono p-3 text-xs text-text-3">{day(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className="mt-6 text-text-3">Nothing matches those filters.</p>}
    </main>
  );
}
