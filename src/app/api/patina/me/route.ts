import { readSessionId } from "@/lib/session";
import { evidenceOf, getProfile, resolveProfileId } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { buildExhibits } from "@/lib/story";

/**
 * The caller's own score.
 *
 * Empty rather than an error when they have connected nothing, because having
 * connected nothing is the normal state of a first visit and a 404 would make
 * the connect page handle a failure that is not one.
 */
function emptyResponse() {
  const empty = scorePatina({});
  return {
    total: empty.total,
    verdict: verdict(empty),
    components: empty.components,
    oldestSignal: null,
    sourcesConnected: [] as string[],
    exhibits: [] as unknown[],
    scopesRead: {} as Record<string, number>,
    provisional: true,
    provisionalReason: empty.provisionalReason,
    username: null as string | null,
    /** Whether this profile is tied to a Personal Server, so it survives a cleared cookie. */
    anchored: false,
  };
}

export async function GET() {
  const sessionId = await readSessionId();
  if (!sessionId) return Response.json(emptyResponse());

  const profileId = await resolveProfileId(sessionId);
  const profile = profileId ? await getProfile(profileId) : null;
  if (!profile) return Response.json(emptyResponse());

  const evidence = evidenceOf(profile);
  const score = scorePatina(evidence);

  return Response.json({
    total: score.total,
    verdict: verdict(score),
    components: score.components,
    oldestSignal: score.oldestSignal,
    sourcesConnected: score.sourcesConnected,
    // Per-source facts for the exhibit cards: each one carries its OWN date and
    // counts, rather than the merged totals the score works from.
    exhibits: buildExhibits(evidence),
    // How many scopes actually came back per source. A partial source still
    // counts, and somebody comparing their score with a friend's on the same
    // accounts deserves to know why it differs.
    scopesRead: Object.fromEntries(
      Object.entries(profile.sources).map(([source, record]) => [source, record!.scopes.length]),
    ),
    provisional: score.provisional,
    provisionalReason: score.provisionalReason,
    username: profile.username ?? null,
    anchored: Boolean(profile.serverHash),
  });
}
