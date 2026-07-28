import { controllerFor } from "@/lib/vana";
import { readReferralCode, readSessionId } from "@/lib/session";
import {
  evidenceOf,
  getProfile,
  getRequest,
  profileIdForCode,
  recordSource,
  rememberRequest,
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
  const sessionId = await readSessionId();
  if (sessionId !== pending.profileId) {
    return Response.json({ error: "Not your request" }, { status: 403 });
  }

  // Every readApprovedData call settles a fee. Serve the cached copy so a
  // replayed request id cannot drain escrow a cent at a time.
  if (pending.result !== undefined) {
    return Response.json(await withScore(pending.profileId, pending.result, true));
  }

  const result = await controllerFor(pending.source).readApprovedData({ requestId });

  await rememberRequest(requestId, { ...pending, result });

  const scope = (result as { scope?: string }).scope ?? pending.source;

  // Score across everything this person has connected, not just this read: a
  // Vana grant only ever covers the most recent source, so earlier ones live in
  // storage and have to be merged back in.
  const existing = await getProfile(pending.profileId);
  const evidence = {
    ...(existing ? evidenceOf(existing) : {}),
    ...foldRead({}, scope, result),
  };
  const score = scorePatina(evidence);

  await recordSource(
    pending.profileId,
    pending.source,
    {
      scope,
      readAt: new Date().toISOString(),
      externalId: identityOf(scope, result),
      evidence: foldRead({}, scope, result),
    },
    score.total,
    await referrerFor(pending.profileId),
  );

  return Response.json(await withScore(pending.profileId, result, false));
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
