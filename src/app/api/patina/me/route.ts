import { readSessionId } from "@/lib/session";
import { evidenceOf, getProfile, referralTally } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";

/** The caller's own score. Empty, not an error, when they have connected nothing. */
export async function GET() {
  const sessionId = await readSessionId();
  const profile = sessionId ? await getProfile(sessionId) : null;

  if (!profile) {
    const empty = scorePatina({});
    return Response.json({
      total: empty.total,
      verdict: verdict(empty),
      components: empty.components,
      oldestSignal: null,
      sourcesConnected: [],
      readAt: {},
      referralCode: null,
      referralCount: 0,
      referralInvited: 0,
    });
  }

  const score = scorePatina(evidenceOf(profile));
  const tally = await referralTally(profile.referralCode);

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
  });
}
