import { evidenceOf, profileByUsername } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { buildAttestation } from "@/lib/attest";
import { checkLookupRate } from "@/lib/ratelimit";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Public, machine-readable score verification.
 *
 * Any app can GET this to read someone's live Patina score and the signed
 * attestation behind it, then verify the signature offline against Patina's app
 * address. CORS is open because the whole point is for OTHER apps to consume it
 *. Which is also how the Vana Cup's "assist" is earned: your users' data,
 * helping another app.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "cache-control": "no-store",
};

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  // Open, but not for bulk use. One name at a time is the contract; a wordlist
  // run against this rebuilds the directory of who is on Patina, which is what
  // never publishing a public list of who is here was for.
  const rate = await checkLookupRate(request);
  if (!rate.allowed) {
    return Response.json(
      { error: "Too many lookups. Slow down." },
      { status: 429, headers: { ...CORS, "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  const { username } = await params;
  const profile = await profileByUsername(decodeURIComponent(username));

  if (!profile || !profile.username) {
    return Response.json(
      { error: "No Patina score for that name" },
      { status: 404, headers: CORS },
    );
  }

  const score = scorePatina(evidenceOf(profile));
  const oldestYear = score.oldestSignal
    ? new Date(score.oldestSignal.date).getUTCFullYear()
    : null;

  const attestation = await buildAttestation({
    username: profile.username,
    score: score.total,
    verdict: verdict(score),
    oldestYear,
    sources: score.sourcesConnected.length,
  });

  return Response.json(
    {
      username: profile.username,
      score: score.total,
      verdict: verdict(score),
      oldestYear,
      sourcesConnected: score.sourcesConnected,
      components: score.components,
      issuedAt: attestation.issuedAt,
      docs: siteUrl("/docs"),
      attestation: {
        app: attestation.app,
        message: attestation.message,
        signature: attestation.signature,
        howToVerify:
          "Recover the EIP-191 signer of `message` from `signature` (e.g. viem recoverMessageAddress, ethers verifyMessage). It equals `app`, Patina's public app address on Vana.",
      },
    },
    { headers: CORS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
