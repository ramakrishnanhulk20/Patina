"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SOURCE_ORDER, SOURCE_SPECS } from "@/lib/sources";
import type { FunnelReport } from "@/lib/metrics";
import type { Stats } from "@/lib/store";

type Balance = {
  ok: boolean;
  symbol: string;
  available: number;
  connectionsLeft: number;
  /** Days of runway at the recent rate, or null when nothing is being spent. */
  daysLeft: number | null;
  low: boolean;
  empty: boolean;
  advice: string;
  contract: string;
};

type Health = {
  network: string;
  storagePersistent: boolean;
  storageWritable: boolean;
  storageError?: string;
  botProtection: boolean;
  /** Scores are still signed by the key that holds the escrow balance. */
  sharedSigningKey: boolean;
  /** Whether the key in use matches the address the site tells people to expect. */
  signer: { matches: boolean; published: string; configured: string | null };
};

/**
 * The operator's view, ordered by what would make somebody act tonight.
 *
 * Alarms first, because the two things that can silently switch Patina off, an
 * empty escrow balance and a database that is not really a database, both look
 * exactly like a healthy site from the outside. Then the funnel, because that
 * is the thing decisions get made from. Then the totals, which are the least
 * urgent and the most often asked for.
 */
export function Dashboard({
  stats,
  funnel,
  balance,
  health,
}: {
  stats: Stats;
  funnel: FunnelReport;
  balance: Balance;
  health: Health;
}) {
  const router = useRouter();

  const alarms: Array<{ level: "bad" | "warn"; text: string }> = [];

  if (!health.storagePersistent) {
    alarms.push({
      level: "bad",
      text: "No database configured. Everything is in memory and will be lost when the server restarts.",
    });
  } else if (!health.storageWritable) {
    alarms.push({
      level: "bad",
      text: `The database is not writable. ${health.storageError ?? ""}`.trim(),
    });
  }

  if (balance.empty) {
    alarms.push({ level: "bad", text: balance.advice });
  } else if (balance.low) {
    alarms.push({ level: "warn", text: balance.advice });
  } else if (!balance.ok) {
    alarms.push({ level: "warn", text: balance.advice });
  }

  /**
   * Checked before anything else, because it is the only failure here that
   * makes Patina look dishonest rather than broken.
   *
   * On mainnet a mismatch means every verifier is being told that every real
   * score is a forgery, while the site itself shows no error at all. Off
   * mainnet it is the ordinary state of a test deployment and worth only a
   * note, so the two are not given the same volume.
   */
  if (!health.signer.matches) {
    alarms.push({
      level: health.network === "mainnet" ? "bad" : "warn",
      text: health.signer.configured
        ? `Scores are being signed by ${health.signer.configured}, but the site publishes ${health.signer.published}. ${
            health.network === "mainnet"
              ? "Every verifier is currently being told that every genuine Patina score is a forgery. Either PATINA_ATTESTATION_KEY or the address in src/lib/patina-address.ts is wrong."
              : "Expected on a test deployment, which signs with its own key."
          }`
        : "No signing key works at all, so no score can be signed. Check PATINA_ATTESTATION_KEY.",
    });
  }

  if (health.sharedSigningKey) {
    alarms.push({
      level: "warn",
      text: "Scores are signed with the same key that holds the money. Set PATINA_ATTESTATION_KEY so a leak of one is not a leak of both.",
    });
  }

  if (!health.botProtection) {
    alarms.push({
      level: "warn",
      text: "Bot protection is off. Set ALTCHA_HMAC_KEY, or a script can spend the escrow balance in a loop.",
    });
  }

  if (health.network !== "mainnet") {
    alarms.push({
      level: "warn",
      text: `Running on ${health.network}. Real scores and Vana Cup points only happen on mainnet.`,
    });
  }

  if (stats.unproven > 0) {
    alarms.push({
      level: "warn",
      text: `${stats.unproven} ${stats.unproven === 1 ? "source was" : "sources were"} connected before ownership was checked. They may be fine; there is no way to tell from here.`,
    });
  }

  const by = (name: string) => funnel.rows.find((row) => row.name === name)?.total ?? 0;

  const scopeRefusals = by("multi_scope_refused");
  if (scopeRefusals > 0) {
    alarms.push({
      level: "bad",
      text: `${scopeRefusals} ${scopeRefusals === 1 ? "grant has" : "grants have"} refused the extra scopes Patina asked for in one approval. If this keeps happening, signup needs one approval per kind of data instead of one per source, which is four times the steps for the same money. Worth investigating today.`,
    });
  }

  const paidAndFailed = by("read_paid_and_failed");
  if (paidAndFailed > 0) {
    alarms.push({
      level: "warn",
      text: `${paidAndFailed} ${paidAndFailed === 1 ? "connection" : "connections"} took a fee and returned nothing. That is escrow spent with no score to show for it, and those people got a worse experience than an ordinary error.`,
    });
  }

  const started = by("connect_started");
  const finished = by("connect_finished");
  const handoffs = by("handoff_shown");
  const completion = started === 0 ? null : Math.round((finished / started) * 100);

  const [rebuilding, setRebuilding] = useState(false);
  const [rebuilt, setRebuilt] = useState<string | null>(null);

  /**
   * Only useful when the count looks too low, which is why it says what it
   * found rather than just succeeding. "Added 12" and "added 0" are different
   * answers and the difference is the entire reason to press it.
   */
  async function rebuildIndex() {
    setRebuilding(true);
    setRebuilt(null);
    try {
      const res = await fetch("/api/admin/rebuild-index", { method: "POST" });
      const body = await res.json();
      setRebuilt(
        res.ok
          ? `Found ${body.found} profiles in storage. The count now says ${body.profilesNow}, of which ${body.connectedNow} have connected something.`
          : "That did not work.",
      );
      router.refresh();
    } catch {
      setRebuilt("That did not work.");
    } finally {
      setRebuilding(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="t-label text-text-3">Patina admin</p>
          <h1 className="t-section mt-2 text-text">
            {alarms.some((a) => a.level === "bad") ? "Something needs you." : "Everything is running."}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="tap t-label text-text-3 underline-offset-4 hover:text-text hover:underline"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            className="tap t-label text-text-3 underline-offset-4 hover:text-text hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>

      {alarms.length > 0 && (
        <section className="mt-8 flex flex-col gap-2">
          {alarms.map((alarm) => (
            <div
              key={alarm.text}
              className={`border-l-2 px-4 py-3 text-sm leading-relaxed ${
                alarm.level === "bad"
                  ? "border-bad bg-bad/10 text-bad"
                  : "border-warn bg-warn/5 text-warn"
              }`}
            >
              {alarm.text}
            </div>
          ))}
        </section>
      )}

      {/* ---------------------------------------------------------- money */}
      <Section title="Money left">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure
            label="Connections funded"
            value={balance.ok ? balance.connectionsLeft.toLocaleString() : "unknown"}
            tone={balance.empty ? "bad" : balance.low ? "warn" : "good"}
          />
          <Figure
            label="Days of runway"
            /*
             * "No usage yet" rather than a number, because dividing a balance
             * by a burn rate of zero is not infinity, it is a question that
             * has not been asked yet. Printing a huge number would be a claim
             * nobody measured.
             */
            value={
              !balance.ok
                ? "unknown"
                : balance.daysLeft === null
                  ? "no usage yet"
                  : Math.floor(balance.daysLeft).toLocaleString()
            }
            tone={balance.daysLeft === null ? undefined : balance.low ? "warn" : "good"}
          />
          <Figure
            label={`Balance${balance.symbol ? ` (${balance.symbol})` : ""}`}
            value={balance.ok ? balance.available.toFixed(4) : "unknown"}
          />
          <Figure label="Finished so far" value={finished.toLocaleString()} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-text-4">
          Every connection settles a real fee from the prepaid escrow account. Top it up at the
          escrow contract <code className="break-all text-text-3">{balance.contract}</code> on{" "}
          {health.network}.
        </p>
      </Section>

      {/* --------------------------------------------------------- funnel */}
      <Section title="The funnel">
        <div className="grid gap-4 sm:grid-cols-4">
          <Figure label="Phone visits turned away" value={handoffs.toLocaleString()} />
          <Figure label="Connections started" value={started.toLocaleString()} />
          <Figure label="Connections finished" value={finished.toLocaleString()} />
          <Figure
            label="Finish rate"
            value={completion === null ? "no data yet" : `${completion}%`}
            tone={completion === null ? undefined : completion < 40 ? "warn" : "good"}
          />
        </div>

        {!funnel.available && (
          <p className="mt-4 border-l-2 border-warn bg-warn/5 px-4 py-3 text-sm text-warn">
            No database, so nothing is being counted. These numbers stay at zero until Redis is
            configured.
          </p>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="t-label py-2 font-normal text-text-3">What</th>
                <th className="t-label py-2 text-right font-normal text-text-3">All time</th>
                <th className="t-label py-2 text-right font-normal text-text-3">Last 14 days</th>
              </tr>
            </thead>
            <tbody>
              {funnel.rows.map((row) => {
                const recent = row.daily.reduce((sum, day) => sum + day.value, 0);
                return (
                  <tr key={row.name} className="border-b border-line/60">
                    <td className="py-2.5 text-text-2">{row.label}</td>
                    <td className="py-2.5 text-right tabular-nums text-text">
                      {row.total.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-text-3">
                      {recent.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* --------------------------------------------------------- people */}
      <Section title="People">
        <div className="grid gap-4 sm:grid-cols-4">
          <Figure label="Connected something" value={stats.connected.toLocaleString()} />
          <Figure label="Claimed a name" value={stats.named.toLocaleString()} />
          <Figure label="Signable scores" value={stats.signable.toLocaleString()} />
          <Figure label="Average score" value={String(stats.averageScore)} />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="t-label py-2 font-normal text-text-3">Source</th>
                <th className="t-label py-2 text-right font-normal text-text-3">Connected</th>
                <th className="t-label py-2 text-right font-normal text-text-3">Refused: not theirs</th>
                <th className="t-label py-2 text-right font-normal text-text-3">Refused: empty</th>
              </tr>
            </thead>
            <tbody>
              {SOURCE_ORDER.map((id) => (
                <tr key={id} className="border-b border-line/60">
                  <td className="py-2.5 text-text-2">{SOURCE_SPECS[id].label}</td>
                  <td className="py-2.5 text-right tabular-nums text-text">
                    {(stats.bySource[id] ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-text-3">
                    {(funnel.bySource.read_unproven?.[id] ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-text-3">
                    {(funnel.bySource.read_empty?.[id] ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-text-4">
          {stats.profiles.toLocaleString()} profiles exist in total, including{" "}
          {(stats.profiles - stats.connected).toLocaleString()} that never connected anything.
        </p>

        <div className="mt-6 border-t border-line pt-5">
          <p className="text-xs leading-relaxed text-text-4">
            Counting was added after Patina launched, so anybody who connected before that is not
            in these numbers. If the total looks too low, this walks storage and adds the ones the
            index missed. Safe to run twice.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={rebuildIndex}
              disabled={rebuilding}
              className="tap t-label border border-line px-3 py-2 text-text-3 hover:border-text-3 hover:text-text disabled:opacity-50"
            >
              {rebuilding ? "Rebuilding..." : "Rebuild the user index"}
            </button>
            {rebuilt && <span className="text-xs text-text-3">{rebuilt}</span>}
          </div>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="t-label border-b border-line pb-3 text-text-3">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const colour =
    tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "good" ? "text-accent" : "text-text";
  return (
    <div className="border border-line bg-panel px-4 py-4">
      <p className="t-label text-text-4">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${colour}`}>{value}</p>
    </div>
  );
}
