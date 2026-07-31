import { isSourceId } from "@/lib/vana";
import { readApprovedDataSettled } from "@/lib/vana-settle-read";
import { readReferralCode, readSessionId } from "@/lib/session";
import {
  evidenceOf,
  getProfile,
  getRequest,
  profileIdForCode,
  recordSource,
  rememberRequest,
  resolveProfileId,
  type PendingRequest,
} from "@/lib/store";
import { foldRead, identityOf } from "@/lib/normalize";
import { scorePatina, verdict } from "@/lib/score";

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("requestId");

  if (!requestId) {
    return Response.json({ error: "Missing requestId" }, { status: 400 });
  }

  const pending = await getRequest(requestId);
  if (!pending) {
    return Response.json({ error: "Unknown requestId" }, { status: 404 });
  }

  // Only the session that started this request may read its result. Without
  // this, anyone holding a request id could pull back someone else's data.
  //
  // Compared against the RESOLVED profile, because a person who signs in
  // mid-flow has their browser re-pointed at their wallet profile, and their
  // own in-flight request must not start failing as a result.
  const browserSession = await readSessionId();
  const sessionProfile = browserSession ? await resolveProfileId(browserSession) : null;
  if (sessionProfile !== pending.profileId) {
    return Response.json({ error: "Not your request" }, { status: 403 });
  }

  try {
    if (!isSourceId(pending.source)) {
      return Response.json({ error: "Unknown source" }, { status: 400 });
    }

    // Prefer gateway settle (payForOp) before X-PAYMENT retry — matches the
    // protocol docs. The stock SDK path only signs a header and was leaving
    // every Patina read on "still requires payment after escrow settlement".
    const result =
      pending.result ?? (await readApprovedDataSettled(pending.source, requestId));

    if (pending.result === undefined) {
      await rememberRequest(requestId, { ...pending, result });
    }

    // Recording is idempotent and happens on BOTH paths, including the cached one.
    //
    // This is the important part. Caching used to happen before recording, so if
    // the write failed (a Redis blip, a cold instance timing out) the retry would
    // hit the cache, skip recording, and return early. The user had paid, the read
    // had succeeded, and their source was silently lost with no way to recover it.
    await ensureRecorded(pending, result);

    return Response.json(await withScore(pending.profileId, result, pending.result !== undefined));
  } catch (err) {
    // Without this, Next turns SDK failures into an opaque 500 and the connect
    // UI can only say "Something went wrong (500)" — which is what users report
    // while Vana sits on "waiting for Patina to finish".
    const message = err instanceof Error ? err.message : "Failed to read approved data";
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : undefined;
    const details =
      err && typeof err === "object" && "details" in err ? err.details : undefined;
    console.error("[vana/data]", { requestId, source: pending.source, code, message, details });
    return Response.json({ error: message, code, details }, { status: 502 });
  }
}

/**
 * Fold a read into the profile, unless that already happened.
 *
 * Safe to call repeatedly with the same read: it overwrites the same source
 * slot with the same data and re-ranks to the same score.
 */
async function ensureRecorded(pending: PendingRequest, result: unknown): Promise<void> {
  const existing = await getProfile(pending.profileId);
  const scope = (result as { scope?: string }).scope ?? pending.source;
  const evidence = foldRead({}, scope, result);

  // Nothing usable came back. Recording an empty source would claim a slot and
  // stop a later, better read from filling it.
  if (Object.keys(evidence).length === 0) return;

  const merged = { ...(existing ? evidenceOf(existing) : {}), ...evidence };
  const score = scorePatina(merged);

  await recordSource(
    pending.profileId,
    pending.source,
    {
      scope,
      readAt: existing?.sources[pending.source]?.readAt ?? new Date().toISOString(),
      externalId: identityOf(scope, result),
      evidence,
    },
    score.total,
    await referrerFor(pending.profileId),
  );
}

/**
 * The referral code to credit, or nothing.
 *
 * Refuses to credit someone for inviting themselves, which is otherwise the
 * first thing anybody tries.
 */
async function referrerFor(profileId: string): Promise<string | undefined> {
  const code = await readReferralCode();
  if (!code) return undefined;

  const owner = await profileIdForCode(code);
  if (!owner || owner === profileId) return undefined;

  return code;
}

async function withScore(profileId: string, result: unknown, cached: boolean) {
  const profile = await getProfile(profileId);
  const score = scorePatina(profile ? evidenceOf(profile) : {});

  return {
    ...(result as object),
    cached,
    patina: {
      total: score.total,
      verdict: verdict(score),
      components: score.components,
      oldestSignal: score.oldestSignal,
      sourcesConnected: score.sourcesConnected,
    },
  };
}
