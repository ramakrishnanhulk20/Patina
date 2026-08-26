import { readSessionId } from "@/lib/session";
import {
  evidenceOf,
  getProfile,
  removeSource,
  resolveProfileId,
} from "@/lib/store";
import { isSourceId, SOURCE_SPECS } from "@/lib/sources";
import { scorePatina, verdict } from "@/lib/score";
import { SCOPE_SOURCE } from "@/lib/normalize";

export const dynamic = "force-dynamic";

/**
 * Everything Patina holds about the caller, and the ability to take a piece of
 * it away.
 *
 * WHY IT EXISTS. Deletion worked and was well built, and it was the only
 * control anybody had. There was no way to see what was actually stored and no
 * way to download it, which are not conveniences: under UK and EU law, access
 * and portability sit alongside erasure, and Patina had one of the three. For a
 * product whose entire pitch is that it keeps almost nothing, being unable to
 * SHOW that was also a wasted argument. The most persuasive thing here is the
 * export, because it is so short.
 *
 * Everything below reads the caller's own profile through their own session and
 * cannot address anybody else's, which is what makes an endpoint that hands
 * back a full personal record safe to have at all.
 */

/** Show me everything you have. */
export async function GET() {
  const profile = await own();
  if (!profile) {
    return Response.json({ found: false, sources: [], fragments: {}, score: null });
  }

  const evidence = evidenceOf(profile);
  const score = scorePatina(evidence);

  /**
   * The stored fragments, exactly as they sit in the database.
   *
   * Not a summary and not a rendering. The promise on the privacy page is that
   * Patina keeps month buckets and counts and throws the rest away, and the
   * only way to prove that to somebody is to hand them the actual rows and let
   * them look for a caption, an address or a name that is not there.
   */
  return Response.json({
    found: true,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    username: profile.username ?? null,
    /**
     * Reported as a yes/no, never as the value.
     *
     * This is a keyed hash of the URL of somebody's Personal Server. Telling
     * them it exists explains how their profile follows them between devices.
     * Printing it would publish a locator for their personal data in a file
     * they are about to email to themselves.
     */
    anchoredToVanaAccount: Boolean(profile.serverHash),
    score: { total: score.total, verdict: verdict(score), provisional: score.provisional },
    sources: Object.entries(profile.sources ?? {}).map(([id, record]) => ({
      id,
      label: SOURCE_SPECS[id as keyof typeof SOURCE_SPECS]?.label ?? id,
      connectedAt: record!.readAt,
      scopes: record!.scopes,
      ownershipProven: record!.proven === true,
      /** Still a source we offer, or one that has since been withdrawn. */
      retired: !(id in SOURCE_SPECS),
    })),
    fragments: profile.fragments ?? {},
    notStored: [
      "Your name, email address and phone number",
      "Passwords, and any token that could sign in as you",
      "Post captions, message text, and anything you wrote",
      "Home or delivery addresses, and pickup or dropoff points",
      "Other people's names, handles and profile links",
      "Track names, game titles, products and merchants",
      "Exact timestamps. Dates are rounded to the month before they are saved.",
    ],
  });
}

/**
 * Disconnect one source.
 *
 * The alternative used to be deleting everything, which is not a real choice
 * for somebody who connected the wrong account and wants to correct it.
 */
export async function DELETE(request: Request) {
  const source = new URL(request.url).searchParams.get("source");
  if (!source) return Response.json({ error: "Which source?" }, { status: 400 });

  /**
   * Accepts a retired source id as well as a current one.
   *
   * `isSourceId` only knows about sources Patina still offers, and somebody may
   * be holding data from one that has since been withdrawn. Refusing to remove
   * it would leave them permanently unable to delete something they can see on
   * their own page, which is the opposite of the point of this endpoint.
   */
  const known = isSourceId(source) || Object.values(SCOPE_SOURCE).includes(source as never);
  if (!known && !/^[a-z]{2,20}$/.test(source)) {
    return Response.json({ error: "Unknown source" }, { status: 400 });
  }

  const profile = await own();
  if (!profile) return Response.json({ error: "Nothing to remove" }, { status: 404 });

  const updated = await removeSource(profile.id, source as never);
  if (!updated) return Response.json({ error: "Nothing to remove" }, { status: 404 });

  const score = scorePatina(evidenceOf(updated));
  return Response.json({
    ok: true,
    remaining: Object.keys(updated.sources ?? {}),
    score: { total: score.total, verdict: verdict(score), provisional: score.provisional },
  });
}

/** The caller's own profile, or null. Never anybody else's. */
async function own() {
  const sessionId = await readSessionId();
  if (!sessionId) return null;
  const profileId = await resolveProfileId(sessionId);
  return profileId ? getProfile(profileId) : null;
}
