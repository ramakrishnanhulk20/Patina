import { readSessionId } from "@/lib/session";
import { evidenceOf, getProfile, resolveProfileId } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { SOURCE_SPECS } from "@/lib/sources";

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
    sources: {} as Record<string, { readAt: string; scopes: string[] }>,
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

  const score = scorePatina(evidenceOf(profile));

  return Response.json({
    total: score.total,
    verdict: verdict(score),
    components: score.components,
    oldestSignal: score.oldestSignal,
    sourcesConnected: score.sourcesConnected,
    sources: Object.fromEntries(
      Object.entries(profile.sources).map(([source, record]) => [
        source,
        {
          readAt: record!.readAt,
          scopes: record!.scopes,
          // How many of the scopes we asked for actually came back. A partial
          // source still counts, and the person should be able to see that it
          // was partial rather than wonder why their score is lower than a
          // friend's with the same accounts.
          of: SOURCE_SPECS[source as keyof typeof SOURCE_SPECS]?.scopes.length ?? 0,
        },
      ]),
    ),
    provisional: score.provisional,
    provisionalReason: score.provisionalReason,
    username: profile.username ?? null,
    anchored: Boolean(profile.serverHash),
  });
}
