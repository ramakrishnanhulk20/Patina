import { controllerFor } from "@/lib/vana";
import { isSourceId } from "@/lib/sources";
import { ensureSessionId, readSessionId } from "@/lib/session";
import {
  evidenceOf,
  getProfile,
  getRequest,
  profileForServer,
  rememberRequest,
  resolveProfileId,
} from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { checkConnectRate } from "@/lib/ratelimit";
import { countAsync } from "@/lib/metrics";
import { siteUrl } from "@/lib/site";
import {
  createDefaultAccessRequestClient,
  getDirectEndpoints,
} from "@opendatalabs/vana-sdk/server";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "@/lib/vana";

/**
 * Getting somebody's profile back on a new device, without charging them for it.
 *
 * THE PROBLEM. Patina has no accounts and no passwords, which is a good
 * decision and removes a whole class of trouble. Identity is the user's
 * Personal Server: every approval reveals which one they are, so connecting a
 * source on a new laptop already finds the profile made on the old one and
 * carries on. That machinery works and nobody knew it existed. A person who
 * cleared their cookies landed on an empty board and reasonably concluded that
 * an evening's work was gone.
 *
 * It also was not free. The only route back ran through a full connection: a
 * desktop import, and a real fee settled against the escrow, to re-learn
 * something Patina could have been told for nothing.
 *
 * WHAT THIS DOES INSTEAD. An approval, and then nothing. The status that comes
 * back from an approved request carries `personalServerUrl`, which is the whole
 * identity, and learning it costs nothing: fees are settled at the Personal
 * Server READ, and this never reads. One approval trip, no import, no charge,
 * and the profile is back.
 *
 * WHY IT STILL ACKNOWLEDGES. Vana's approval tab waits for the app to finish
 * and only then releases itself. Walking away from an approved request would
 * leave the person staring at "Delivering your data" on a page Patina does not
 * control. Acknowledging is a state transition rather than a read, so it costs
 * nothing and closes the loop properly.
 */

/** Start a restore: create an access request whose data will never be read. */
export async function POST(request: Request) {
  const source = new URL(request.url).searchParams.get("source");

  if (!isSourceId(source)) {
    return Response.json({ error: "Unknown source" }, { status: 400 });
  }

  // Same bucket as connecting. This creates a real access request on Vana, so
  // an unmetered version would be a way to make somebody else's infrastructure
  // do work in a loop, even though no money moves.
  const existingSession = await readSessionId();
  const rate = await checkConnectRate(request, existingSession);
  if (!rate.allowed) {
    return Response.json(
      { error: "That is a lot of attempts in a short time. Try again a little later." },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  const sessionId = await ensureSessionId();

  /**
   * Deliberately NOT `ensureProfileId`.
   *
   * Minting a profile here would create an empty one for a browser whose whole
   * purpose is to be reunited with an existing profile, and empty profiles are
   * counted. The session is bound to a profile in `profileForServer` below,
   * once there is a real one to bind it to.
   */
  const profileId = (await resolveProfileId(sessionId)) ?? "";

  const accessRequest = await controllerFor(source).createAccessRequest({
    returnUrl: siteUrl("/connect"),
  });

  await rememberRequest(accessRequest.requestId, {
    source,
    profileId,
    createdAt: new Date().toISOString(),
    /**
     * Marks this request as restore-only.
     *
     * `/api/vana/data` refuses to act on one, so a restore request id cannot be
     * replayed against the read route to get a free paid read, and the two
     * flows cannot be confused for one another by a future change.
     */
    restoreOnly: true,
  });

  return Response.json({ ...accessRequest, source });
}

/** Finish a restore: learn which Personal Server this is, and hand the profile back. */
export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("requestId");
  if (!requestId) return Response.json({ error: "Missing requestId" }, { status: 400 });

  const pending = await getRequest(requestId);
  if (!pending) return Response.json({ error: "Unknown requestId" }, { status: 404 });
  if (!pending.restoreOnly) {
    return Response.json({ error: "Not a restore request" }, { status: 400 });
  }
  if (!isSourceId(pending.source)) {
    return Response.json({ error: "Unknown source" }, { status: 400 });
  }

  const sessionId = await readSessionId();
  if (!sessionId) return Response.json({ error: "No session" }, { status: 403 });

  /**
   * Checked against the profile the session resolved to WHEN THE REQUEST WAS
   * MADE, which for a fresh browser is the empty string.
   *
   * The connect routes compare against a resolved profile id, which works
   * because the person already has one. Here they usually do not: that is the
   * entire situation being recovered from. So the guard is that this browser is
   * the one that started this request, which is what the empty-string case
   * encodes, rather than that it already owns a profile.
   */
  const sessionProfile = (await resolveProfileId(sessionId)) ?? "";
  if (sessionProfile !== pending.profileId) {
    return Response.json({ error: "Not your request" }, { status: 403 });
  }

  const status = await controllerFor(pending.source).getAccessRequestStatus(requestId);

  if (!status.personalServerUrl) {
    return Response.json(
      {
        error: "Vana did not say which Personal Server this is, so there is nothing to match on.",
        code: "NO_SERVER",
      },
      { status: 422 },
    );
  }

  const profileId = await profileForServer(sessionId, status.personalServerUrl);
  const profile = await getProfile(profileId);

  // Release Vana's tab. A state change, not a read: nothing is settled by it.
  await acknowledge(requestId);

  const sources = Object.keys(profile?.sources ?? {});
  if (!profile || sources.length === 0) {
    /**
     * Approved, matched, and there was nothing there.
     *
     * Not an error. This is what a first-time visitor who pressed the wrong
     * button sees, and telling them something went wrong would be a lie about
     * their own history. `profileForServer` has still anchored this browser, so
     * anything they connect from here on lands on the right profile.
     */
    return Response.json({ restored: false, sources: [], score: 0, username: null });
  }

  countAsync("profile_restored");

  const score = scorePatina(evidenceOf(profile));
  return Response.json({
    restored: true,
    sources,
    score: score.total,
    verdict: verdict(score),
    username: profile.username ?? null,
  });
}

/**
 * Tell Vana we are finished, so the approval tab closes itself.
 *
 * Failure is logged and swallowed. The restore has already happened by this
 * point: the profile is linked and the person has it back, and reporting an
 * error because a tidy-up call failed would take a success away from them.
 */
async function acknowledge(requestId: string): Promise<void> {
  try {
    const key = process.env.VANA_APP_PRIVATE_KEY;
    if (!key) return;
    const account = privateKeyToAccount(key as `0x${string}`);
    const endpoints = getDirectEndpoints(env);
    const client = createDefaultAccessRequestClient({
      baseUrl: endpoints.accessRequestBaseUrl,
      approvalBaseUrl: endpoints.approvalAppBaseUrl,
      appAddress: account.address,
      signMessage: (message) =>
        account.signMessage({
          message: typeof message === "string" ? message : { raw: message },
        }),
    });
    await client.acknowledgeRead?.(requestId);
  } catch (error) {
    console.warn("[patina/restore] acknowledge failed", {
      requestId,
      error: error instanceof Error ? error.message : error,
    });
  }
}
