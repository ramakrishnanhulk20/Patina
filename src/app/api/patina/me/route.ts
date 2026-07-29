import { readSessionId } from "@/lib/session";
import {
  evidenceOf,
  getProfile,
  referralTally,
  resolveProfileId,
  standingOf,
} from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { REWARD } from "@/lib/rewards";

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
  const profile = await getProfile(profileId);

  if (!profile) {
    return Response.json(EMPTY());
  }

  const score = scorePatina(evidenceOf(profile));
  const [tally, standing] = await Promise.all([
    referralTally(profile.referralCode),
    standingOf(profile.id, REWARD.places),
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
    deviceToken: profile.deviceToken,
    referralCount: tally.qualified,
    referralInvited: tally.invited,
    rank: standing.rank,
    totalScored: standing.total,
    // A profile id prefixed g: came from Google sign-in, so it is stable across
    // devices; anything else is still just this browser.
    signedIn: profile.id.startsWith("g:"),
    username: profile.username ?? null,
  });
}
