import { createChallenge, verifySolution } from "altcha-lib/v1";
import { Redis } from "@upstash/redis";

/**
 * An invisible bot check in front of the one endpoint that spends money.
 *
 * Starting a connection (`/api/vana/request`) leads to a paid read settled
 * against our escrow, so a script hammering it in a loop is somebody spending
 * our balance. The rate limiter already caps how often one caller can try;
 * this raises the floor further by making every single attempt solve a small
 * proof-of-work first. A real person's browser does it in well under a second
 * and never sees it. A bare `curl` loop cannot do it at all, and a headless
 * one has to burn real CPU on every request. Combined, that turns a cheap
 * automated attack into a slow, costly one.
 *
 * Self-hosted, deliberately: the challenges are signed and verified here with
 * our own key, so nothing is sent to Google or hCaptcha. An app whose whole
 * pitch is "your data stays yours" has no business phoning a third party on
 * every connect.
 *
 * ALTCHA is the open-source proof-of-work scheme this implements. We use its v1
 * (hashcash-style SHA-256) protocol, which the browser can solve with plain Web
 * Crypto and no library. See the solver in connect/useConnect.ts.
 */

/** Difficulty. The browser hashes on average half this many times per solve. */
const MAX_NUMBER = 50_000;

/**
 * How long a challenge stays valid. Long enough to cover a slow solve on a weak
 * phone, short enough that a captured payload is worthless minutes later. Also
 * the lifetime of the replay guard below, so a solved challenge cannot be
 * reused past the point where it could have been solved honestly.
 */
const EXPIRY_SECONDS = 5 * 60;

/** Read at call time, not module load, so a key added after boot is picked up. */
function hmacKey(): string | undefined {
  return process.env.ALTCHA_HMAC_KEY;
}

/**
 * Whether the bot check is switched on. Unset, the connect flow runs without it
 * so a deploy that has not had the key added yet still works. Add ALTCHA_HMAC_KEY
 * to turn it on. Surfaced on /api/health.
 */
export function altchaConfigured(): boolean {
  return Boolean(hmacKey());
}

/** A fresh, single-use challenge for the browser to solve. */
export async function newAltchaChallenge() {
  return createChallenge({
    hmacKey: hmacKey()!,
    maxnumber: MAX_NUMBER,
    expires: new Date(Date.now() + EXPIRY_SECONDS * 1000),
  });
}

/**
 * Redis, under whichever of the two credential names is set (same as the rest
 * of the app). Used only to burn a solved challenge so it cannot be replayed.
 */
let client: Redis | null | undefined;
function redis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/**
 * True the FIRST time a given challenge signature is presented, false after.
 *
 * verifySolution proves the work was done, but not that this exact payload has
 * not already been spent. A `SET NX` on the signature makes one solve worth one
 * request. Fails OPEN, like the rate limiter: a Redis outage must not block real
 * connects, and the short expiry caps how long a replay window a failure opens.
 */
async function firstUse(signature: string): Promise<boolean> {
  const store = redis();
  if (!store) return true;
  try {
    const won = await store.set(`patina:v1:altcha:${signature}`, "1", {
      nx: true,
      ex: EXPIRY_SECONDS,
    });
    return won === "OK";
  } catch {
    return true;
  }
}

/**
 * Verify a solved challenge. False for anything not solved, tampered, expired,
 * or replayed. Returns false when unconfigured too, but callers gate on
 * altchaConfigured() first, so an unset key skips the check rather than blocking.
 */
export async function verifyAltcha(payload: string): Promise<boolean> {
  const key = hmacKey();
  if (!key || !payload) return false;

  // The signature identifies the challenge and is what the replay guard keys on.
  let signature: string | undefined;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as {
      signature?: unknown;
    };
    if (typeof decoded.signature === "string") signature = decoded.signature;
  } catch {
    return false;
  }
  if (!signature) return false;

  const solved = await verifySolution(payload, key, true);
  if (!solved) return false;

  return firstUse(signature);
}
