import { altchaConfigured, newAltchaChallenge } from "@/lib/altcha";

export const dynamic = "force-dynamic";

/**
 * Hands the browser a fresh proof-of-work challenge to solve before it may start
 * a connection. Each is single use and short lived.
 *
 * Returns `{ configured: false }` when no ALTCHA key is set, so the connect flow
 * keeps working (unprotected) until the key is added. Never cached: a reused
 * challenge is a reused solve.
 */
export async function GET() {
  if (!altchaConfigured()) {
    return Response.json({ configured: false }, { headers: { "cache-control": "no-store" } });
  }

  const challenge = await newAltchaChallenge();
  return Response.json(challenge, { headers: { "cache-control": "no-store" } });
}
