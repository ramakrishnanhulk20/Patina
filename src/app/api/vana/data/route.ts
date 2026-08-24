import { isSourceId } from "@/lib/sources";
import { emptySourceMessage, readSourceSettled, SourceEmptyError } from "@/lib/vana-settle-read";
import { controllerFor } from "@/lib/vana";
import { readSessionId } from "@/lib/session";
import {
  evidenceOf,
  getProfile,
  getRequest,
  profileForServer,
  recordSource,
  rememberRequest,
  resolveProfileId,
  type PendingRequest,
} from "@/lib/store";
import { identityOf, readScope, type Fragment } from "@/lib/normalize";
import { scorePatina, verdict } from "@/lib/score";

/**
 * Finish one connection: read every scope the grant covers, normalise, record,
 * and hand back the new score.
 *
 * THE TIMING CONSTRAINT THAT SHAPES THIS ROUTE. The SDK is explicit that a
 * `completed` request is terminal and not read-ready, because "the browser
 * Personal Server may no longer be serving it". The Personal Server is up while
 * the USER is. There is one window, it is now, and it closes when they close the
 * tab. So every scope is read in one burst here rather than deferred to a job,
 * and the acknowledgement that ends the request fires only once all of them have
 * landed (see vana-settle-read.ts).
 */
export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("requestId");

  if (!requestId) {
    return Response.json({ error: "Missing requestId" }, { status: 400 });
  }

  const pending = await getRequest(requestId);
  if (!pending) {
    return Response.json({ error: "Unknown requestId" }, { status: 404 });
  }

  if (!isSourceId(pending.source)) {
    return Response.json({ error: "Unknown source" }, { status: 400 });
  }

  /**
   * Only the session that started this request may read its result. Without
   * this, anyone holding a request id could pull back someone else's data.
   *
   * Compared against the RESOLVED profile, because a person whose browser gets
   * folded into an established profile mid-flow (their Personal Server turning
   * out to be one we already know) must not have their own in-flight request
   * start failing as a result.
   */
  const sessionId = await readSessionId();
  const sessionProfile = sessionId ? await resolveProfileId(sessionId) : null;
  if (!sessionId || sessionProfile !== pending.profileId) {
    return Response.json({ error: "Not your request" }, { status: 403 });
  }

  try {
    /**
     * A cached result short-circuits the read, so a replayed request id cannot
     * re-spend escrow. Cached as normalised FRAGMENTS rather than raw payloads:
     * the raw ones carry captions, home addresses and other people's names, and
     * parking those in a cache for a day would undo the point of discarding
     * them on arrival.
     */
    const cached = pending.reads !== undefined;
    const { reads, externalId } = cached
      ? { reads: pending.reads!, externalId: pending.externalId }
      : await collect(pending, requestId);

    if (!cached) {
      await rememberRequest(requestId, { ...pending, reads, ...(externalId ? { externalId } : {}) });
    }

    if (reads.length === 0) {
      console.info("[vana/data] empty source", { requestId, source: pending.source });
      return Response.json(
        { error: emptySourceMessage(pending.source), code: "SOURCE_EMPTY" },
        { status: 422 },
      );
    }

    /**
     * Resolve identity BEFORE recording, so the reads land on the right profile.
     *
     * The approval is the first moment we learn which Personal Server this
     * browser belongs to. If it belongs to a profile made on another machine,
     * this browser is folded into it and the reads join the history already
     * there, rather than starting a second half-finished profile for the same
     * person.
     */
    const profileId = await destination(pending, sessionId, requestId);

    // Recording is idempotent and happens on BOTH paths, including the cached
    // one. Caching used to happen before recording, so a failed write meant the
    // retry hit the cache, skipped recording and returned early: the user had
    // paid, the read had succeeded, and their source was silently lost.
    const profile = await recordSource(profileId, pending.source, reads, { externalId });

    const score = scorePatina(evidenceOf(profile));

    return Response.json({
      source: pending.source,
      scopes: reads.map((read) => read.scope),
      cached,
      patina: {
        total: score.total,
        verdict: verdict(score),
        components: score.components,
        oldestSignal: score.oldestSignal,
        sourcesConnected: score.sourcesConnected,
        provisional: score.provisional,
        provisionalReason: score.provisionalReason,
      },
      username: profile.username ?? null,
    });
  } catch (err) {
    /**
     * Without this, Next turns SDK failures into an opaque 500 and the connect
     * UI can only say "Something went wrong (500)", which is what users report
     * while Vana sits on "waiting for Patina to finish".
     */
    const message = err instanceof Error ? err.message : "Failed to read approved data";
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : undefined;
    const details = err && typeof err === "object" && "details" in err ? err.details : undefined;

    console.error("[vana/data]", { requestId, source: pending.source, code, message, details });

    // An empty source is the user's to fix (nothing imported, wrong account,
    // still collecting), not a server fault. 422 so the UI shows guidance.
    const status = err instanceof SourceEmptyError || code === "SOURCE_EMPTY" ? 422 : 502;
    return Response.json({ error: message, code, details }, { status });
  }
}

/**
 * Read every scope and normalise on the way through.
 *
 * Raw payloads never leave this function. What comes out is fragments: month
 * buckets and counts, with the captions, addresses, emails and other people's
 * names already gone.
 */
async function collect(
  pending: PendingRequest,
  requestId: string,
): Promise<{ reads: Array<{ scope: string; fragment: Fragment }>; externalId?: string }> {
  const result = await readSourceSettled(pending.source, requestId);

  const reads: Array<{ scope: string; fragment: Fragment }> = [];
  let externalId: string | undefined;

  for (const read of result.reads) {
    // The account handle has to be taken from the RAW payload, here, because it
    // is one of the things normalize discards: a fragment is month buckets and
    // counts, with no handle left in it to find.
    externalId ??= identityOf(read.scope, read.data);

    const fragment = readScope(read.scope, read.data);
    // A scope that read fine but yielded nothing usable is not an error. It
    // simply scores nothing, and the source still counts on its other scopes.
    if (fragment) reads.push({ scope: read.scope, fragment });
  }

  return { reads, ...(externalId ? { externalId } : {}) };
}

/**
 * Which profile these reads belong to.
 *
 * Asks Vana for the Personal Server behind this approval and lets the store
 * decide, which is what makes a profile follow somebody between machines. If
 * the lookup fails for any reason, fall back to the profile the request was
 * created against: a missing cross-device link is a small loss, and refusing to
 * record a read the user has already paid for is a large one.
 */
async function destination(
  pending: PendingRequest,
  sessionId: string,
  requestId: string,
): Promise<string> {
  try {
    const status = await controllerFor(pending.source).getAccessRequestStatus(requestId);
    if (status.personalServerUrl) {
      return await profileForServer(sessionId, status.personalServerUrl);
    }
  } catch (err) {
    console.warn("[vana/data] could not resolve the personal server", {
      requestId,
      error: err instanceof Error ? err.message : err,
    });
  }
  return pending.profileId;
}
