import { isPersistent, storeSelfTest } from "@/lib/store";
import { appAddress } from "@/lib/vana";

export const dynamic = "force-dynamic";

/**
 * Is this deployment actually wired up?
 *
 * Exists because the two failures that matter here are both SILENT. If the
 * Redis credentials are missing the app still boots, still scores people, and
 * quietly forgets everything on the next cold start. If VANA_NETWORK is left on
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
  const network = process.env.VANA_NETWORK === "mainnet" ? "mainnet" : "moksha";

  let address: string | null = null;
  try {
    address = appAddress();
  } catch {
    // Missing or malformed app key. Reported as null below rather than thrown,
    // because a health endpoint that 500s tells you less than one that answers.
  }

  const storeWritable = await storeSelfTest();
  const persistent = isPersistent();

  return Response.json(
    {
      ok: Boolean(address) && storeWritable && persistent,
      network,
      scoresCupPoints: network === "mainnet",
      appAddress: address,
      storage: {
        configured: persistent,
        writable: storeWritable,
        // Named so the problem is obvious at a glance rather than needing a doc.
        warning: persistent
          ? undefined
          : "No Redis credentials found. Running on in-memory storage: every profile is lost when the instance recycles.",
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
