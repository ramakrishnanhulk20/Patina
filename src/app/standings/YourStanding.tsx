import Link from "next/link";
import { ShareCard } from "../connect/ShareCard";
import { evidenceOf, getProfile, leaguePoints, referralTally, POINTS_PER_REFERRAL } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { REWARD } from "@/lib/rewards";

/**
 * The viewer's own line on the board, and now the whole of it.
 *
 * The first question anyone brings to a competition is "where am I, and how do
 * I move up". This answers both, and then hands over the exact thing that moves
 * them up, their shareable card, so the answer and the action sit together.
 *
 * A server component. It is handed its position as plain numbers rather than
 * the ranked list it used to search through, because that list carried other
 * people's profile ids into a page that renders in a browser. Nothing about
 * anybody else reaches this component now, so nothing about anybody else can
 * leak out of it.
 */
export async function YourStanding({
  profileId,
  rank,
  total,
  cutoffPoints,
}: {
  profileId: string | null;
  /** The viewer's place, or null when they are below the ranked cut. */
  rank: number | null;
  /** Everyone with a score, for the "of N" denominator. */
  total: number;
  /** Points held by the last paying place, so a gap can be stated concretely. */
  cutoffPoints: number | null;
}) {
  const profile = profileId ? await getProfile(profileId) : null;
  const connected = profile ? Object.keys(profile.sources).length > 0 : false;

  // Signed out, or here before connecting anything: there is no position to
  // show, so the card becomes the invitation to get one rather than an empty
  // slot at the top of the page.
  if (!profile || !connected) {
    return (
      <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
        <p className="t-label text-text-3">Your position</p>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-text">
          You are not on the board yet.
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-2">
          Connect one account to get a score and claim a place. First one on the board is first
          place.
        </p>
        <Link href="/connect" className="btn btn-primary mt-5 inline-block px-6 py-3.5 text-base">
          Get on the board
        </Link>
      </section>
    );
  }

  const score = scorePatina(evidenceOf(profile));
  const points = leaguePoints(score.total, profile.referrals ?? 0);
  const tally = await referralTally(profile.referralCode);

  const inMoney = rank !== null && rank <= REWARD.places;
  const gap =
    !inMoney && cutoffPoints !== null ? Math.max(1, cutoffPoints - points + 1) : null;

  const climb = inMoney
    ? `You are inside the paying top ${REWARD.places}. Bring real people to hold your place.`
    : rank === null
      ? `You have a score. Bring a real person or connect another account to break into the ranked places, each real one is +${POINTS_PER_REFERRAL}.`
      : gap !== null
        ? `${gap === 1 ? "1 point" : `${gap} points`} from the top ${REWARD.places} that share the reward. Each real person you bring is +${POINTS_PER_REFERRAL}, and that is the fastest way up.`
        : `Bring a real person to climb, each one is +${POINTS_PER_REFERRAL} points.`;

  return (
    <section>
      <div className="rounded-2xl border border-accent/40 bg-gradient-to-b from-accent-wash to-panel p-5 sm:p-6">
        <p className="t-label text-text-3">Your position</p>
        <p className="mt-2 flex items-end gap-2">
          <span className="t-display text-accent">{rank !== null ? `#${rank}` : "Unranked"}</span>
          {rank !== null && <span className="pb-2 text-lg text-text-3">of {total}</span>}
        </p>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-text-2">{climb}</p>
      </div>

      {/*
        The card, right here. The whole point of knowing your position is to do
        something about it, and sharing is the something, so it is one scroll
        away from the number, not on a different page.
      */}
      <div className="mt-3">
        <ShareCard
          score={{
            total: score.total,
            verdict: verdict(score),
            components: score.components,
            oldestSignal: score.oldestSignal,
            sourcesConnected: score.sourcesConnected,
          }}
          referralCode={profile.referralCode}
          referralCount={tally.qualified}
          username={profile.username ?? null}
          points={points}
          rank={rank}
        />
      </div>
    </section>
  );
}
