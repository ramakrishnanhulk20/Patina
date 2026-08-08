import { isPersistent, storeSelfTest } from "@/lib/store";
import { appAddress } from "@/lib/vana";
import { altchaConfigured } from "@/lib/altcha";

export const dynamic = "force-dynamic";

/**
 * Is this deployment actually wired up?
 *
 * Exists because the two failures that matter here are both SILENT. If the
 * Redis credentials are missing the app still boots, still scores people, and
 * quietly forgets everything on the next cold start. If VANA_NETWORK is set to
 * moksha the app works perfectly and earns nothing, because Cup points are only
 * scored on mainnet.
 *
 * `storeWritable` does a real write-then-read round trip, so a misconfigured
 * database cannot pass by having the right variables set.
 *
 * Everything returned is public: a network name, the app's on-chain address
 * (which users see on the approval screen anyway), and booleans. No secrets.
 */
export async function GET() {
  const network = process.env.VANA_NETWORK === "moksha" ? "moksha" : "mainnet";

  let address: string | null = null;
  try {
    address = appAddress();
  } catch {
    // Missing or malformed app key. Reported as null below rather than thrown,
    // because a health endpoint that 500s tells you less than one that answers.
  }

  const store = await storeSelfTest();
  const persistent = isPersistent();

  return Response.json(
    {
      ok: Boolean(address) && store.ok && persistent,
      network,
      scoresCupPoints: network === "mainnet",
      appAddress: address,
      // Whether the invisible bot check on the connect endpoint is switched on.
      // Off until ALTCHA_HMAC_KEY is set; connecting still works either way.
      botProtection: altchaConfigured(),
      storage: {
        configured: persistent,
        writable: store.ok,
        // Which call broke, and what it said. A bare false tells you writes are
        // failing and nothing about where, which is no use in production.
        failedAt: store.failedAt,
        error: store.error,
        credentialSource: process.env.UPSTASH_REDIS_REST_URL
          ? "UPSTASH_REDIS_REST_*"
          : process.env.KV_REST_API_URL
            ? "KV_REST_API_*"
            : "none",
        warning: persistent
          ? undefined
          : "No Redis credentials found. Running on in-memory storage: every profile is lost when the instance recycles.",
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
