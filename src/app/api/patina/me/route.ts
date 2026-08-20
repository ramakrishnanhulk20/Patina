import { readSessionId } from "@/lib/session";
import {
  evidenceOf,
  getProfile,
  referralTally,
  resolveProfileId,
  standingOf,
  leaguePoints,
} from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";

const RANKED_DEPTH = 50;

const EMPTY = () => {
  const empty = scorePatina({});
  return {
    total: empty.total,
    verdict: verdict(empty),
    components: empty.components,
    oldestSignal: null,
    sourcesConnected: [],
    readAt: {},
    referralCode: null,
    referralCount: 0,
    referralInvited: 0,
    points: 0,
    referrals: 0,
    rank: null as number | null,
    totalScored: 0,
    signedIn: false,
    username: null as string | null,
  };
};

/** The caller's own score. Empty, not an error, when they have connected nothing. */
export async function GET() {
  const sessionId = await readSessionId();
  if (!sessionId) return Response.json(EMPTY());

  // Resolved, so a signed-in person sees one profile no matter which device
  // they happen to be holding.
  const profileId = await resolveProfileId(sessionId);
  const profile = profileId ? await getProfile(profileId) : null;

  if (!profile) {
    return Response.json(EMPTY());
  }

  const score = scorePatina(evidenceOf(profile));
  const [tally, standing] = await Promise.all([
    referralTally(profile.referralCode),
    // Depth of the ranked window to look through. Not a reward threshold any
    // more, just how far down the board a rank is still worth reporting.
    standingOf(profile.id, RANKED_DEPTH),
  ]);

  return Response.json({
    total: score.total,
    verdict: verdict(score),
    components: score.components,
    oldestSignal: score.oldestSignal,
    sourcesConnected: score.sourcesConnected,
    readAt: Object.fromEntries(
      Object.entries(profile.sources).map(([source, record]) => [source, record.readAt]),
    ),
    referralCode: profile.referralCode,
    referralCount: tally.qualified,
    referralInvited: tally.invited,
    points: leaguePoints(profile.score, profile.referrals),
    referrals: profile.referrals ?? 0,
    rank: standing.rank,
    totalScored: standing.total,
    inTheMoney: standing.inTheMoney,
    // A profile id prefixed g: came from Google sign-in, so it is stable across
    // devices; anything else is still just this browser.
    signedIn: profile.id.startsWith("g:"),
    username: profile.username ?? null,
  });
}
