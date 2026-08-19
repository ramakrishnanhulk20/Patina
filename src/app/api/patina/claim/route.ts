import { readSessionId } from "@/lib/session";
import { getProfile, resolveProfileId, setPayoutAddress, winnerEntry } from "@/lib/store";
import { checkUsernameRate } from "@/lib/ratelimit";
import { CLAIM_CLOSES_AT, CLAIM_OPENS_AT, claimPageLive, claimWindowState } from "@/lib/rewards";

export const dynamic = "force-dynamic";

/**
 * Whether the caller qualified for a share, and what they have submitted.
 *
 * Eligibility is read from the frozen list taken at the whistle, never from the
 * live ranking. Somebody connecting today is welcome, but they were not in the
 * top 50 when the competition closed and must not be able to walk into a place
 * that was decided weeks ago.
 */
export async function GET() {
  // The page is a 404 after the window, so its API is too. Leaving a live
  // endpoint behind a dead page is how a "closed" process quietly stays open.
  if (!claimPageLive()) return new Response("Not found", { status: 404 });

  const sessionId = await readSessionId();
  const profileId = sessionId ? await resolveProfileId(sessionId) : null;

  // The window is reported from the server clock, so a browser with the wrong
  // time cannot show somebody an open form that the server will refuse.
  const window = {
    window: claimWindowState(),
    opensAt: CLAIM_OPENS_AT,
    closesAt: CLAIM_CLOSES_AT,
    serverTime: new Date().toISOString(),
  };

  if (!profileId) {
    return Response.json(
      { signedIn: false, eligible: false, reason: "no-profile", ...window },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const [profile, entry] = await Promise.all([getProfile(profileId), winnerEntry(profileId)]);

  return Response.json(
    {
      signedIn: true,
      stableIdentity: profileId.startsWith("g:"),
      eligible: entry !== null,
      rank: entry?.rank ?? null,
      points: entry?.points ?? null,
      username: profile?.username ?? null,
      payoutAddress: profile?.payoutAddress ?? null,
      ...window,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Submit or change the wallet address a share should be paid to. */
export async function POST(request: Request) {
  if (!claimPageLive()) return new Response("Not found", { status: 404 });

  const sessionId = await readSessionId();
  const profileId = sessionId ? await resolveProfileId(sessionId) : null;

  if (!profileId) {
    return Response.json(
      { ok: false, reason: "This browser has no Patina profile. Sign in on the device you used." },
      { status: 401 },
    );
  }

  const rate = await checkUsernameRate(request, sessionId);
  if (!rate.allowed) {
    return Response.json(
      { ok: false, reason: "Too many tries just now. Give it a minute." },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  /**
   * The window is checked HERE, on the server, and not merely hidden in the UI.
   * A closed form that still accepts a POST is not a deadline, it is a
   * suggestion, and this one decides who gets paid.
   */
  const state = claimWindowState();
  if (state === "before") {
    return Response.json(
      { ok: false, reason: "The claim window has not opened yet.", window: state },
      { status: 403 },
    );
  }
  if (state === "closed") {
    return Response.json(
      { ok: false, reason: "The claim window has closed.", window: state },
      { status: 403 },
    );
  }

  const entry = await winnerEntry(profileId);
  if (!entry) {
    return Response.json(
      { ok: false, reason: "This profile was not in the top 50 when the standings were frozen." },
      { status: 403 },
    );
  }

  let address: unknown;
  try {
    address = (await request.json())?.address;
  } catch {
    return Response.json({ ok: false, reason: "Bad request." }, { status: 400 });
  }

  if (typeof address !== "string") {
    return Response.json({ ok: false, reason: "Paste your wallet address." }, { status: 400 });
  }

  const result = await setPayoutAddress(profileId, address);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
