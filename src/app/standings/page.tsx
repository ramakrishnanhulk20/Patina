import Link from "next/link";
import { SectionLabel } from "../components/SectionLabel";
import { CupStanding } from "../components/CupStanding";
import { YourStanding } from "./YourStanding";
import { readSessionId } from "@/lib/session";
import { resolveProfileId, standingFor } from "@/lib/store";
import { scorePatina } from "@/lib/score";
import { REWARD } from "@/lib/rewards";
import { POINTS_PER_REFERRAL, REFERRAL_QUALIFIES_AT } from "@/lib/store";

export const metadata = {
  title: "Standings",
  description:
    "Where you stand on Patina, your Patina score plus what you brought in, and whether you are currently inside the places that share the reward.",
};

export const dynamic = "force-dynamic";

/**
 * Your position, and nothing about anyone else.
 *
 * This page used to publish the ranked list: name, score, referrals and year
 * for the top entries. Two things were wrong with that, one urgent and one
 * structural.
 *
 * The urgent one: each row carried its profile id as a React key, React ships
 * keys to the browser inside the payload it sends for hydration, and a profile
 * id was at the time a working session credential. The public leaderboard was
 * therefore handing out the keys to its own top accounts.
 *
 * The structural one: even with the ids gone, a published list of
 * (name, score, year) is a join table. Patina promises that looking somebody up
 * by a platform handle reveals a score but never which Patina profile it is
 * (see resolveIdentity in mcp-lookup.ts, where the rule is spelled out as
 * non-negotiable). A public list of names next to scores defeats that by
 * letting anybody match the two up, so the promise only holds if the list does
 * not exist.
 *
 * Per-person data is still reachable, deliberately, through the documented
 * routes: /api/verify/<username>, /api/badge/<username> and the MCP server.
 * Those take a name you already know and answer about that one person. What has
 * gone is the enumeration: there is no longer anywhere that hands out the set of
 * who exists.
 */
export default async function StandingsPage() {
  const sessionId = await readSessionId();
  const mine = sessionId ? await resolveProfileId(sessionId) : null;

  // Re-score from evidence so a formula change (or a stale rank index) cannot
  // leave someone at "score 78 / points 2" forever. Returns the viewer's own
  // numbers only: no ids, and no rows for anybody else.
  const standing = await standingFor(mine, REWARD.places, (evidence) => scorePatina(evidence).total);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Standings</SectionLabel>

      <h1 className="t-section mt-5 text-text">Where you stand.</h1>

      {/*
        The viewer's own standing, first and only. Everything below is context
        for it: what points mean, and where Patina sits in the Cup. See
        YourStanding for the signed-out and not-yet-connected states.
      */}
      <div className="mt-6">
        <YourStanding
          profileId={mine}
          rank={standing.rank}
          total={standing.total}
          cutoffPoints={standing.cutoffPoints}
        />
      </div>

      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-text-2">
        Ranked by <span className="text-text">points</span>, which are your Patina score plus{" "}
        {POINTS_PER_REFERRAL} for every real person you bring. The top {REWARD.places} share the
        reward if Patina places in the Vana Cup.
      </p>

      {/*
        Said outright, because a ranking invites exactly the wrong reading.
        High here means "did the most for this", not "is the most human".
      */}
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-3">
        Being high here means you contributed most, not that you are the most human. Your Patina
        score is the separate, smaller number, and nothing but your own history can move it.
      </p>

      {/*
        Why there is no list to scroll. People will notice it went, and an
        unexplained removal on a page about a competition reads as something
        being hidden. It is the opposite.
      */}
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-3">
        Patina does not publish a public list of everyone and their scores. A page pairing names
        with scores is enough to work out which accounts belong to whom, which is the one thing
        this product exists not to do. You can see your own position, and anyone you give your
        name to can check your score at{" "}
        <Link href="/verify" className="text-accent underline underline-offset-4">
          verify
        </Link>
        . Nobody can read off the whole board.
      </p>

      {/*
        The board that actually decides the money. Patina's own position in the
        Vana Cup is public, external, and about the app rather than any person.
      */}
      <div className="mt-8">
        <CupStanding />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        <div className="bg-panel p-5">
          <dt className="t-label text-text-3">People scored</dt>
          <dd className="t-mono mt-2 text-2xl text-text">{standing.total.toLocaleString()}</dd>
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

      <p className="mt-8 text-sm leading-relaxed text-text-3">
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
