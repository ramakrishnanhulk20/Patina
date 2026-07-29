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
function callerKey(request: Request, sessionId: string | null): string {
  if (sessionId) return `sid:${sessionId}`;

  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim();
  return ip ? `ip:${ip}` : "ip:unknown";
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
 * Shared counter. Fails OPEN, deliberately: blocking real users to stop a
 * hypothetical one is the wrong trade when the downside is a few cents and a
 * few wasted names.
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

  const key = `patina:v1:rate:${bucket}:${callerKey(request, sessionId)}`;

  try {
    const count = await store.incr(key);
    if (count === 1) await store.expire(key, windowSeconds);

    if (count > max) {
      const ttl = await store.ttl(key);
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
