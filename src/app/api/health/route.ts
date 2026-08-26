import { isPersistent, storeSelfTest } from "@/lib/store";
import { appAddress } from "@/lib/vana";
import { altchaConfigured } from "@/lib/altcha";
import { balanceAdvice, readEscrowBalance } from "@/lib/escrow-balance";
import { signerCheck, usingSharedKey } from "@/lib/attest";

export const dynamic = "force-dynamic";

/**
 * Is this deployment actually wired up, and can it still pay its way?
 *
 * Exists because the failures that matter here are all SILENT. If the Redis
 * credentials are missing the app still boots, still scores people, and quietly
 * forgets everything on the next cold start. If VANA_NETWORK is set to moksha
 * the app works perfectly and earns nothing, because Cup points are only scored
 * on mainnet. And if the escrow balance runs out, every connection fails at the
 * payment step while every page on the site keeps rendering perfectly.
 *
 * `storeWritable` does a real write-then-read round trip, so a misconfigured
 * database cannot pass by having the right variables set. The balance is a live
 * read against the escrow gateway for the same reason: configuration being
 * present says nothing about whether there is money behind it.
 *
 * WHAT THE STATUS CODE MEANS, and why it is not always 200. This endpoint is
 * meant to be polled by an uptime monitor, and monitors alert on status codes,
 * not on the shape of a JSON body. Returning 200 with `ok: false` inside is how
 * a health check ends up being technically correct and operationally useless.
 * So a deployment that cannot do its job answers 503, which is a thing anybody's
 * monitoring will notice without being taught what to look for.
 *
 * Everything returned is public: a network name, the app's on-chain address
 * (which users see on the approval screen anyway), booleans, and how much
 * runway is left. No secrets.
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

  const [store, balance] = await Promise.all([storeSelfTest(), readEscrowBalance()]);
  const persistent = isPersistent();
  const signer = signerCheck();

  /**
   * Wired up correctly, and able to serve the next person who arrives.
   *
   * An empty balance counts as not ok. It is not a warning: with nothing left
   * to settle, connecting is broken for everybody, which is the same outage as
   * the database being unreachable and deserves the same alarm.
   *
   * A balance that merely could not be READ does not fail the check. The
   * gateway being briefly unreachable is not the same as being out of money,
   * and waking somebody at night for a network blip is how alerts get ignored.
   */
  const ok =
    Boolean(address) &&
    store.ok &&
    persistent &&
    !balance.empty &&
    (network !== "mainnet" || signer.matches);

  return Response.json(
    {
      ok,
      network,
      scoresCupPoints: network === "mainnet",
      appAddress: address,
      // Whether the invisible bot check on the connect endpoint is switched on.
      // Off until ALTCHA_HMAC_KEY is set; connecting still works either way.
      botProtection: altchaConfigured(),
      // True while scores are still signed by the key that holds the escrow
      // balance, so a leak of one secret would be a leak of both.
      sharedSigningKey: usingSharedKey(),
      /**
       * Whether the key signing scores matches the address the site publishes.
       *
       * False on mainnet means every verifier is being told that every genuine
       * score is a forgery, with nothing else on the site looking wrong. It is
       * therefore part of `ok` on mainnet and only informational elsewhere,
       * where signing with a local test key is the expected state.
       */
      signerMatchesPublished: signer.matches,
      signerAddress: signer.configured,
      publishedAddress: signer.published,
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
      /**
       * The prepaid balance every connection spends from.
       *
       * `connectionsLeft` is the number worth reading. A raw token amount does
       * not tell anybody whether to act tonight; "about forty more people can
       * connect" does.
       */
      escrow: {
        readable: balance.ok,
        asset: balance.symbol || undefined,
        available: balance.ok ? balance.available : undefined,
        availableRaw: balance.ok ? balance.availableRaw : undefined,
        connectionsLeft: balance.ok ? balance.connectionsLeft : undefined,
        low: balance.low,
        empty: balance.empty,
        advice: balanceAdvice(balance),
        error: balance.error,
      },
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
