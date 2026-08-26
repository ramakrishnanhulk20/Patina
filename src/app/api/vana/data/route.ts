import { isSourceId, proofMissingMessage, proofScopeFor } from "@/lib/sources";
import {
  emptySourceMessage,
  PaidButFailedError,
  readSourceSettled,
  SourceEmptyError,
} from "@/lib/vana-settle-read";
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
import { countAsync } from "@/lib/metrics";

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

  // A restore request was approved on the promise that nothing would be read
  // from it. Reading one here would settle a fee the person was told they would
  // not pay, so the flows are kept strictly apart.
  if (pending.restoreOnly) {
    return Response.json(
      { error: "That request was for restoring a profile, not for reading data." },
      { status: 400 },
    );
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
    const { reads, scopesServed, externalId } = cached
      ? {
          reads: pending.reads!,
          scopesServed: pending.scopesServed ?? [],
          externalId: pending.externalId,
        }
      : await collect(pending, requestId);

    if (!cached) {
      await rememberRequest(requestId, {
        ...pending,
        reads,
        scopesServed,
        ...(externalId ? { externalId } : {}),
      });
    }

    /**
     * THE OWNERSHIP CHECK, and the only one Patina is able to make.
     *
     * Vana collects two ways. Desktop runs a connector on the user's own
     * machine and makes them sign in. The web path collects server-side, and
     * server-side collection reads a public page, which proves that an account
     * exists and nothing whatsoever about who is holding it. Nothing in the
     * protocol reports which path a read came through, so this cannot be asked
     * directly; see the note on `proof` in sources.ts.
     *
     * What it can do is insist on a scope a public page does not have. Every
     * source declares one, and it has to have been SERVED. Not "scored": an
     * empty Watch Later is a perfectly good signed-in answer that yields no
     * evidence, and refusing that would fail people for having a tidy account.
     *
     * Deliberately placed BEFORE recordSource and AFTER the cache write, so a
     * refused read is refused identically on every retry and cannot be turned
     * into an accepted one by replaying the request id.
     */
    const proof = proofScopeFor(pending.source);
    if (!scopesServed.includes(proof)) {
      console.warn("[vana/data] proof scope missing", {
        requestId,
        source: pending.source,
        proof,
        served: scopesServed,
      });
      countAsync("read_unproven", pending.source);
      return Response.json(
        { error: proofMissingMessage(pending.source), code: "PROOF_MISSING" },
        { status: 422 },
      );
    }

    if (reads.length === 0) {
      console.info("[vana/data] empty source", { requestId, source: pending.source });
      countAsync("read_empty", pending.source);
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
    const profile = await recordSource(profileId, pending.source, reads, {
      externalId,
      proven: true,
    });

    // Only counted on the uncached path. A retry that hits the cache is the
    // same connection arriving twice, and counting it again would report more
    // finished connections than there were people.
    if (!cached) countAsync("connect_finished", pending.source);

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
    /**
     * Three outcomes, not two, because they cost different things.
     *
     * An empty source is the user's to fix and gets 422 with guidance. A
     * failure after payment cost real money and is ours; it gets its own
     * counter so the rate of it is visible, and its own message so nobody is
     * sent off to check an import that was never the problem. Everything else
     * is an ordinary fault.
     */
    const paidAndFailed = err instanceof PaidButFailedError || code === "PAID_BUT_FAILED";
    const empty = err instanceof SourceEmptyError || code === "SOURCE_EMPTY";
    const status = empty || paidAndFailed ? 422 : 502;

    countAsync(
      paidAndFailed ? "read_paid_and_failed" : empty ? "read_empty" : "read_failed",
      pending.source,
    );
    if (paidAndFailed) {
      console.error("[vana/data] escrow spent with nothing returned", {
        requestId,
        source: pending.source,
        message,
      });
    }
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
): Promise<{
  reads: Array<{ scope: string; fragment: Fragment }>;
  scopesServed: string[];
  externalId?: string;
}> {
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

  return {
    reads,
    // What the Personal Server answered, before normalize had an opinion about
    // whether any of it was scorable. This is what the proof check reads.
    scopesServed: result.reads.map((read) => read.scope),
    ...(externalId ? { externalId } : {}),
  };
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
