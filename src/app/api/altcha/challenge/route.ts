import { altchaConfigured, newAltchaChallenge } from "@/lib/altcha";
import { checkChallengeRate } from "@/lib/ratelimit";
import { readSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Hands the browser a fresh proof-of-work challenge to solve before it may start
 * a connection. Each is single use and short lived.
 *
 * Returns `{ configured: false }` when no ALTCHA key is set, so the connect flow
 * keeps working (unprotected) until the key is added. Never cached: a reused
 * challenge is a reused solve.
 *
 * Rate limited because minting a challenge is signed work this server performs
 * on request, so an unmetered route is free CPU for anybody who asks. The cap is
 * far above what the solver's single retry can reach.
 */
export async function GET(request: Request) {
  const rate = await checkChallengeRate(request, await readSessionId());
  if (!rate.allowed) {
    return Response.json(
      { error: "Too many challenges. Try again shortly." },
      {
        status: 429,
        headers: { "retry-after": String(rate.retryAfterSeconds), "cache-control": "no-store" },
      },
    );
  }

  if (!altchaConfigured()) {
    return Response.json({ configured: false }, { headers: { "cache-control": "no-store" } });
  }

  const challenge = await newAltchaChallenge();
  return Response.json(challenge, { headers: { "cache-control": "no-store" } });
}
