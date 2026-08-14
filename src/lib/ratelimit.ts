import { Redis } from "@upstash/redis";

/**
 * A cap on how often one visitor can start a connection.
 *
 * The Vana builder guide says to rate limit this route and we had not, which
 * left a real hole. Creating an access request is free, but COMPLETING one
 * settles a fee against our escrow, and nothing stopped the same person
 * connecting the same account over and over from fresh sessions. At a cent a
 * time that is slow, but it is somebody else spending our money, and the
 * balance is finite.
 *
 * Deliberately generous. Four sources, plus retries after a failed approval,
 * plus a household sharing an IP on mobile data. This is a backstop against
 * abuse, not a queue: a real person should never meet it.
 *
 * Fails OPEN. If Redis is unreachable the connect flow keeps working, because
 * blocking every genuine user to stop a hypothetical attacker is a bad trade
 * when the downside is a few cents.
 */

const WINDOW_SECONDS = 60 * 60;
const MAX_PER_WINDOW = 25;

let client: Redis | null | undefined;

function redis(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/**
 * The caller's address, as reported by the platform.
 *
 * `x-forwarded-for` is client-controlled in general, but on Vercel the platform
 * rewrites it, so the FIRST entry is the real peer. Falls back to a constant so
 * a missing header shares one bucket rather than silently disabling the limit.
 */
function ipKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim();
  return ip ? `ip:${ip}` : "ip:unknown";
}

/**
 * Every bucket this request has to clear, all of which must pass.
 *
 * The session bucket USED TO REPLACE the address bucket: a request carrying a
 * session was counted against that session and nothing else. The session comes
 * from a cookie, and a cookie is whatever the caller says it is, so rotating it
 * per request bought an unlimited number of empty buckets and the limit never
 * fired. Worse, the incentive ran backwards. Sending no cookie left you capped
 * by address, while sending a junk one let you through unmetered.
 *
 * The address bucket is therefore unconditional now. It is the only part of
 * this the caller cannot choose for themselves, so it is the only part that can
 * carry the guarantee. The session bucket is kept ON TOP as a tighter, fairer
 * cap: it stops one person burning a shared office or mobile-carrier address
 * that other real people are sitting behind. It cannot be relied on alone and
 * is no longer asked to be.
 */
export function bucketsFor(request: Request, sessionId: string | null): string[] {
  const keys = [ipKey(request)];
  if (sessionId) keys.push(`sid:${sessionId}`);
  return keys;
}

export type RateVerdict = { allowed: boolean; retryAfterSeconds: number };

export async function checkConnectRate(
  request: Request,
  sessionId: string | null,
): Promise<RateVerdict> {
  return check("connect", request, sessionId, MAX_PER_WINDOW, WINDOW_SECONDS);
}

/**
 * A cap on username attempts.
 *
 * Claiming a name is cheap for us and was completely unmetered, which made the
 * endpoint a free oracle: submit names in a loop and you learn which ones are
 * taken, and you can sit on a rename the instant somebody releases one. Sixty
 * an hour is far more than a person picking a name will ever need and far less
 * than a script needs to be useful.
 */
export async function checkUsernameRate(
  request: Request,
  sessionId: string | null,
): Promise<RateVerdict> {
  return check("username", request, sessionId, 60, WINDOW_SECONDS);
}

/**
 * A cap on the public per-name lookups: /api/verify and /api/badge.
 *
 * These are meant to be open, and they stay open. What the cap removes is BULK
 * use. Both answer "does this name exist, and what is its score", so a script
 * running a name list against them rebuilds the directory of who is on Patina,
 * along with a score for each. That is the enumeration the standings page was
 * changed to stop publishing, and leaving it available one name at a time would
 * hand back most of what removing the list was for.
 *
 * Three hundred an hour per address. A site embedding a badge, or an app
 * verifying its users as they arrive, will never come near it; a script working
 * through a wordlist meets it almost immediately.
 */
export async function checkLookupRate(request: Request): Promise<RateVerdict> {
  return check("lookup", request, null, 300, WINDOW_SECONDS);
}

/**
 * A cap on minting bot-check challenges.
 *
 * Each one is a signed challenge this server generates, so an unmetered
 * endpoint is free work anybody can ask for. Loose enough that the retry in the
 * browser solver never trips it.
 */
export async function checkChallengeRate(
  request: Request,
  sessionId: string | null,
): Promise<RateVerdict> {
  return check("challenge", request, sessionId, 120, WINDOW_SECONDS);
}

/**
 * Shared counter. Fails OPEN, deliberately: blocking real users to stop a
 * hypothetical one is the wrong trade when the downside is a few cents and a
 * few wasted names.
 *
 * Every bucket is incremented on every call, including after one has already
 * refused, so a caller cannot learn which of their buckets is the binding one
 * by watching what does and does not get counted.
 */
async function check(
  bucket: string,
  request: Request,
  sessionId: string | null,
  max: number,
  windowSeconds: number,
): Promise<RateVerdict> {
  const store = redis();
  if (!store) return { allowed: true, retryAfterSeconds: 0 };

  let worst: RateVerdict = { allowed: true, retryAfterSeconds: 0 };

  for (const caller of bucketsFor(request, sessionId)) {
    const key = `patina:v1:rate:${bucket}:${caller}`;

    try {
      const count = await store.incr(key);
      if (count === 1) await store.expire(key, windowSeconds);

      if (count > max) {
        const ttl = await store.ttl(key);
        const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;
        // First refusal denies; a later one only matters if it lasts longer.
        if (worst.allowed || retryAfterSeconds > worst.retryAfterSeconds) {
          worst = { allowed: false, retryAfterSeconds };
        }
      }
    } catch {
      // A Redis blip on one bucket must not deny a request the others allowed.
    }
  }

  return worst;
}
