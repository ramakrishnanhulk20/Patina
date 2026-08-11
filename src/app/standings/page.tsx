import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";
import { CupStanding } from "../components/CupStanding";
import { YourStanding } from "./YourStanding";
import { readSessionId } from "@/lib/session";
import { resolveProfileId, scoredProfileCount, standings } from "@/lib/store";
import { scorePatina } from "@/lib/score";
import { REWARD } from "@/lib/rewards";
import { POINTS_PER_REFERRAL, REFERRAL_QUALIFIES_AT } from "@/lib/store";

export const metadata = {
  title: "Standings",
  description:
    "Who has the most points on Patina, Patina score plus what they brought in, and who is currently inside the places that share the reward.",
};

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const sessionId = await readSessionId();
  const mine = sessionId ? await resolveProfileId(sessionId) : null;

  const [rows, total] = await Promise.all([
    // Re-score from evidence so a formula change (or a stale rank index) cannot
    // leave someone at "score 78 / points 2" forever.
    standings(REWARD.places, (evidence) => scorePatina(evidence).total),
    scoredProfileCount(),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Standings</SectionLabel>

      <h1 className="t-section mt-5 text-text">The most worn-in people here.</h1>

      {/*
        The viewer's own standing, first. Everything below is context for it:
        what points mean, where Patina sits in the Cup, and who else is on the
        board. See YourStanding for the signed-out and not-yet-connected states.
      */}
      <div className="mt-6">
        <YourStanding profileId={mine} rows={rows} total={total} />
      </div>

      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-text-2">
        Ranked by <span className="text-text">points</span>, which are your Patina score plus{" "}
        {POINTS_PER_REFERRAL} for every real person you bring. The top {REWARD.places} share the
        reward if Patina places in the Vana Cup.
      </p>

      {/*
        Said outright, because a leaderboard invites exactly the wrong reading.
        Top of this board means "did the most for this", not "is the most human".
      */}
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-3">
        Being high here means you contributed most, not that you are the most human. Your Patina
        score is the separate, smaller number, and nothing but your own history can move it. Names
        are chosen by each person; the accounts behind a score are never shown.
      </p>

      {/*
        The board that actually decides the money. This page is Patina's own
        internal standing; the Cup is the one the prize pays against, and it is
        the reason any of this matters, so it goes up top.
      */}
      <div className="mt-8">
        <CupStanding />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        <div className="bg-panel p-5">
          <dt className="t-label text-text-3">People scored</dt>
          <dd className="t-mono mt-2 text-2xl text-text">{total.toLocaleString()}</dd>
        </div>
        <div className="bg-panel p-5">
          <dt className="t-label text-text-3">Places that share</dt>
          <dd className="t-mono mt-2 text-2xl text-accent">{REWARD.places}</dd>
        </div>
        <div className="col-span-2 bg-panel p-5 sm:col-span-1">
          <dt className="t-label text-text-3">Closes</dt>
          <dd className="mt-2 text-lg text-text">{REWARD.cupClosesAt}</dd>
        </div>
      </dl>

      {rows.length === 0 ? (
        <div className="mt-10 border border-line bg-panel p-8 text-center">
          <p className="text-lg text-text">Nobody has a score yet.</p>
          <p className="mt-2 text-text-3">First one on the board is first place.</p>
          <Link href="/connect" className="btn btn-primary mt-6 inline-block px-6 py-3.5 text-base">
            Go first
          </Link>
        </div>
      ) : (
        <>
          {/*
            A list on phones, a table on desktop.

            A five-column table at 375px means either a horizontal scroll nobody
            discovers or type too small to read. The same data as stacked rows
            reads like an app, which is what most people arrive on.
          */}
          <ul className="mt-8 space-y-2 sm:hidden">
            {rows.map((row, index) => {
              const isMine = mine !== null && row.id === mine;
              const paying = index < REWARD.places;
              return (
                <li
                  key={row.id}
                  className={`flex items-center gap-4 rounded-xl border p-4 ${
                    isMine ? "border-accent/50 bg-accent-wash" : "border-line bg-panel"
                  }`}
                >
                  <span
                    className={`t-mono w-8 shrink-0 text-lg ${
                      paying ? "text-accent" : "text-text-4"
                    }`}
                  >
                    {index + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={`truncate ${
                          row.username ? "font-semibold text-text" : "text-text-4"
                        }`}
                      >
                        {row.username ?? "anonymous"}
                      </span>
                      {isMine && <span className="t-label shrink-0 text-accent">You</span>}
                    </span>
                    <span className="t-mono mt-1 block text-xs text-text-3">
                      score {row.score}
                      {row.referrals > 0 ? ` · brought ${row.referrals}` : ""}
                      {row.oldestYear ? ` · since ${row.oldestYear}` : ""}
                    </span>
                  </span>

                  <span className="t-mono shrink-0 text-2xl text-text">{row.points}</span>
                </li>
              );
            })}
          </ul>

          <div className="mt-10 hidden rounded-lg border border-line sm:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Patina standings, highest score first. The top {REWARD.places} share the reward.
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="t-label p-4 font-medium text-text-3">#</th>
                  <th scope="col" className="t-label p-4 font-medium text-text-3">Who</th>
                  <th scope="col" className="t-label p-4 font-medium text-text-3">Points</th>
                  <th scope="col" className="t-label p-4 font-medium text-text-3">Score</th>
                  <th scope="col" className="t-label p-4 font-medium text-text-3">Brought</th>
                  <th scope="col" className="t-label p-4 font-medium text-text-3">History from</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const isMine = mine !== null && row.id === mine;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-line last:border-b-0 ${
                        isMine ? "bg-accent-wash" : ""
                      }`}
                    >
                      <td className="t-mono p-4 text-text-3">{index + 1}</td>
                      <td className="p-4">
                        <span className={row.username ? "font-semibold text-text" : "text-text-4"}>
                          {row.username ?? "anonymous"}
                        </span>
                        {isMine && <span className="t-label ml-2.5 text-accent">You</span>}
                      </td>
                      <td className="t-mono p-4 text-lg text-text">{row.points}</td>
                      <td className="t-mono p-4 text-text-2">{row.score}</td>
                      <td className="t-mono p-4 text-text-2">
                        {row.referrals > 0 ? row.referrals : <span className="text-text-4">0</span>}
                      </td>
                      <td className="t-mono p-4 text-text-2">
                        {row.oldestYear ?? <span className="text-text-4">n/a</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-6 text-sm leading-relaxed text-text-3">
        Two ways up: connect another account, or bring in someone real. Each person you bring is
        worth {POINTS_PER_REFERRAL} points, and they only count once they have a score of{" "}
        {REFERRAL_QUALIFIES_AT} or more, so empty accounts are worth nothing to anybody.{" "}
        <Link href="/rewards" className="text-accent underline underline-offset-4">
          How the reward works
        </Link>
        .
      </p>

      <div className="mt-10">
        <Link href="/connect" className="btn btn-primary inline-block px-6 py-3.5 text-base">
          Get on the board
        </Link>
      </div>
    </main>
  );
}
