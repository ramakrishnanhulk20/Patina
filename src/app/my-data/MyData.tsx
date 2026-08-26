"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteData } from "../components/DeleteData";

type Source = {
  id: string;
  label: string;
  connectedAt: string;
  scopeCount: number;
  ownershipProven: boolean;
  retired: boolean;
};

type Initial = {
  username: string | null;
  createdAt: string;
  anchored: boolean;
  score: { total: number; verdict: string; provisional: boolean };
  sources: Source[];
};

/**
 * Three controls, in order of how much they take away.
 *
 * Download, then remove one, then remove everything. Ordered so the safe thing
 * is the first one your eye lands on and the irreversible one is last, and
 * spaced so the two are never adjacent. Removing a single source still asks
 * twice, because it costs somebody an import to undo and there is no way back
 * from a stray tap.
 */
export function MyData({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [sources, setSources] = useState(initial.sources);
  const [score, setScore] = useState(initial.score);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  /**
   * The download is built in the browser from the JSON the API returns.
   *
   * A viewer that only rendered the data would prove nothing: the point is for
   * somebody to hold the actual file and search it for the things Patina says
   * it does not keep.
   */
  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/patina/data");
      if (!res.ok) throw new Error("Could not fetch your data.");
      const data = await res.json();

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `patina-${initial.username ?? "profile"}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Freed on the next tick rather than immediately: revoking synchronously
      // races the download in some browsers and produces an empty file.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not fetch your data.");
    } finally {
      setDownloading(false);
    }
  }

  async function remove(id: string) {
    setRemoving(id);
    setError(null);
    try {
      const res = await fetch(`/api/patina/data?source=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Could not remove it.");

      setSources((current) => current.filter((source) => source.id !== id));
      if (body.score) setScore(body.score);
      setConfirming(null);
      // The score on every other page changes too, so re-render them.
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove it.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="mt-10 flex flex-col gap-10">
      {/* ------------------------------------------------------ the summary */}
      <section className="border border-line bg-panel p-5">
        <p className="t-label text-text-3">In short</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-text-4">Your score</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-text">
              {score.total}
              <span className="ml-2 text-sm font-normal text-text-3">{score.verdict}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-4">Sources connected</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-text">{sources.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-4">First connected</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-text">
              {initial.createdAt.slice(0, 10)}
            </dd>
          </div>
        </dl>
        {initial.anchored && (
          <p className="mt-4 text-xs leading-relaxed text-text-4">
            This profile is tied to your Vana account rather than to this browser, so clearing your
            cookies does not lose it. Approving any source on another device brings it back.
          </p>
        )}
      </section>

      {/* ------------------------------------------------------ the download */}
      <section>
        <h2 className="t-label text-text-3">Take a copy</h2>
        <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-text-2">
          A JSON file with every row Patina stores about you, exactly as it sits in the database.
          It is short. Search it for a caption, an address or a friend&apos;s name and you will not
          find one, which is easier to believe than us saying so.
        </p>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className="btn btn-primary mt-4 px-5 py-3 text-base disabled:opacity-50"
        >
          {downloading ? "Preparing..." : "Download my data"}
        </button>
      </section>

      {/* ------------------------------------------------------- the sources */}
      <section>
        <h2 className="t-label text-text-3">What is connected</h2>
        <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-text-2">
          Remove any one of these without touching the rest. Your score will drop by whatever that
          source was contributing, and you can connect it again later.
        </p>

        <ul className="mt-5 flex flex-col divide-y divide-line border-y border-line">
          {sources.map((source) => (
            <li key={source.id} className="flex flex-col gap-3 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="font-semibold text-text">{source.label}</p>
                  <p className="mt-0.5 text-xs text-text-4">
                    Connected {source.connectedAt.slice(0, 10)}, {source.scopeCount}{" "}
                    {source.scopeCount === 1 ? "kind of data" : "kinds of data"}
                    {source.retired && ", no longer offered"}
                  </p>
                </div>
                {confirming === source.id ? null : (
                  <button
                    type="button"
                    onClick={() => setConfirming(source.id)}
                    className="tap t-label shrink-0 text-text-3 underline-offset-4 hover:text-bad hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>

              {!source.ownershipProven && (
                <p className="text-xs leading-relaxed text-warn">
                  This one was connected before Patina started checking that a source really
                  belongs to you. It still counts, and reconnecting it would put that beyond doubt.
                </p>
              )}

              {confirming === source.id && (
                <div className="border border-bad/40 bg-bad/5 p-4">
                  <p className="text-sm leading-relaxed text-text-2">
                    Remove {source.label} and everything Patina derived from it? Your score will
                    drop, and getting it back means running the import again.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => remove(source.id)}
                      disabled={removing === source.id}
                      className="btn border border-bad/50 bg-bad/10 px-4 py-2 text-sm text-bad hover:bg-bad/20 disabled:opacity-50"
                    >
                      {removing === source.id ? "Removing..." : `Yes, remove ${source.label}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="tap t-label text-text-3 underline-offset-4 hover:text-text hover:underline"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {error && <p className="mt-4 text-sm text-bad">{error}</p>}
      </section>

      {/* -------------------------------------------------- the irreversible */}
      <section className="mt-4">
        <h2 className="t-label text-text-3">Erase everything</h2>
        <div className="mt-3">
          <DeleteData />
        </div>
      </section>
    </div>
  );
}
