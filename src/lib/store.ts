/**
 * Where a person's proof lives between visits.
 *
 * Two things force this to be real storage rather than memory:
 *
 *  1. Vercel throws away memory between requests, so anything in a module-level
 *     Map is gone by the time the user comes back.
 *  2. A Vana grant is keyed to the (user, app) pair, NOT to the scope. Approving
 *     a second source REPLACES the first source's scopes, so we get exactly one
 *     chance to read each source. Losing that read means losing it for good, and
 *     re-reading would cost another fee even if it were possible.
 *
 * Upstash is used in production. Locally, or before the Redis credentials
 * exist, it falls back to an in-process Map so the app still runs end to end.
 * The fallback announces itself once rather than pretending everything is fine.
 */

import { cache } from "react";
import { Redis } from "@upstash/redis";
import type { Evidence, SourceId } from "./score";
import { leaguePoints, REFERRAL_QUALIFIES_AT } from "./points.ts";

export type SourceRecord = {
  scope: string;
  readAt: string;
  /**
   * A stable identifier for the ACCOUNT behind this source (channel id, GitHub
   * username, and so on). This, not a wallet, is how we stop one person
   * claiming a reward share several times over: they can clear cookies as often
   * as they like, but it is still the same YouTube channel.
   */
  externalId?: string;
  evidence: Evidence;
};

export type Profile = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sources: Partial<Record<SourceId, SourceRecord>>;
  /** Short public code this person shares to invite others. */
  referralCode: string;
  /**
   * Left over from the device-link flow that Google sign-in replaced. Still
   * present on profiles written before it was removed, never written now, and
   * read by nothing. Optional so new profiles simply do not carry it.
   */
  deviceToken?: string;
  /** The code that brought them here, if any. Set once and never changed. */
  referredBy?: string;
  /** Cached so counting a referrer's qualified invites does not rescore everyone. */
  score: number;
  /** Qualified people this profile brought in. Cached so ranking stays cheap. */
  referrals: number;
  /** Chosen by the person, shown on the standings. Absent until they pick one. */
  username?: string;
  /** Set only when someone claims a reward share. Never asked for up front. */
  payoutAddress?: string;
};

/**
 * The leaderboard constants live in `points.ts`, which imports nothing, so that
 * client components can read them without pulling Redis into the browser
 * bundle. Re-exported here because every server-side caller already reaches for
 * them through the store.
 */
export { REFERRAL_QUALIFIES_AT, POINTS_PER_REFERRAL, leaguePoints } from "./points.ts";

const PREFIX = "patina:v1";
const profileKey = (id: string) => `${PREFIX}:profile:${id}`;
const requestKey = (requestId: string) => `${PREFIX}:request:${requestId}`;
const identityKey = (source: SourceId, externalId: string) =>
  `${PREFIX}:identity:${source}:${externalId.toLowerCase()}`;
const codeKey = (code: string) => `${PREFIX}:code:${code.toLowerCase()}`;

/**
 * Ranked index of every scoring profile.
 *
 * Without this there is no way to answer "who is in the top 50", because
 * profiles are stored under opaque per-session keys with nothing tying them
 * together. That would have been discovered at payout time, which is the single
 * worst moment to find out a public promise cannot be computed.
 */
const RANK_KEY = `${PREFIX}:ranking`;

/**
 * Which profile a browser session belongs to.
 *
 * Identity is the session cookie by default, which makes one person on a phone
 * and a laptop into two people: two profiles, two partial scores, two rows in
 * the standings, and two claims on a single reward share. This map is how that
 * gets undone, by pointing a second browser at a profile it did not create.
 */
const linkKey = (sessionId: string) => `${PREFIX}:link:${sessionId}`;

/**
 * Device tokens are gone.
 *
 * They existed to let somebody carry a profile to a second device by opening a
 * secret link, because the Vana wallet address was not reachable on our path.
 * Google sign-in solved the same problem properly — `sub` is stable across
 * every device a person owns — and the token flow was left behind with no route
 * serving it and nothing able to reach `adoptProfile`. Dead code that mints
 * secrets and writes index keys is worse than dead code that does not, so it
 * has been removed rather than kept for a rainy day. Existing profiles in Redis
 * keep an unused `deviceToken` field; nothing reads it.
 */

/** Usernames are claimed first-come and held here so two people cannot share one. */
const usernameKey = (name: string) => `${PREFIX}:username:${name.toLowerCase()}`;

/** The profile this browser session should read and write. */
export async function resolveProfileId(sessionId: string): Promise<string> {
  const linked = await db().get(linkKey(sessionId));
  return typeof linked === "string" ? linked : sessionId;
}

const invitedKey = (code: string) => `${PREFIX}:invited:${code.toLowerCase()}`;
const qualifiedKey = (code: string) => `${PREFIX}:qualified:${code.toLowerCase()}`;

/**
 * An access request in flight.
 *
 * This has to be shared storage rather than a module-level Map: on Vercel the
 * POST that creates the request and the GET that reads the result can land on
 * different instances, so an in-memory map would lose the source and the read
 * would fail after the user had already approved. That is the worst place to
 * drop someone.
 */
export type PendingRequest = {
  source: SourceId;
  profileId: string;
  createdAt: string;
  /** Cached read result, so a replayed request id cannot re-spend escrow. */
  result?: unknown;
};

export async function rememberRequest(
  requestId: string,
  pending: PendingRequest,
): Promise<void> {
  await db().set(requestKey(requestId), pending);
}

export async function getRequest(requestId: string): Promise<PendingRequest | null> {
  const raw = await db().get(requestKey(requestId));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as PendingRequest) : (raw as PendingRequest);
}

interface Backend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  /**
   * Write only if the key is absent. True when this caller won it.
   *
   * The point of contact with reality: claiming a username was a read followed
   * by a write, so two people typing the same name at the same moment both read
   * "free" and both wrote, and the second silently took it from the first.
   */
  setIfAbsent(key: string, value: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  addToSet(key: string, member: string): Promise<void>;
  removeFromSet(key: string, member: string): Promise<void>;
  setMembers(key: string): Promise<string[]>;
  /** Ranked index. Needed to answer "who is in the top 50" at all. */
  rank(key: string, member: string, score: number): Promise<void>;
  unrank(key: string, member: string): Promise<void>;
  topRanked(key: string, count: number): Promise<{ member: string; score: number }[]>;
  rankedCount(key: string): Promise<number>;
}

let warned = false;

function memoryBackend(): Backend {
  const map = new Map<string, unknown>();
  const sets = new Map<string, Set<string>>();

  if (!warned) {
    warned = true;
    console.warn(
      "[patina] No UPSTASH_REDIS_REST_URL configured. Falling back to in-memory storage: " +
        "profiles will not survive a restart. Fine locally, NOT fine in production.",
    );
  }

  const ranks = new Map<string, Map<string, number>>();

  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async setIfAbsent(key, value) {
      // Single-threaded, so this really is atomic here.
      if (map.has(key)) return false;
      map.set(key, value);
      return true;
    },
    async remove(key) {
      map.delete(key);
    },
    async addToSet(key, member) {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
    },
    async removeFromSet(key, member) {
      sets.get(key)?.delete(member);
    },
    async setMembers(key) {
      return [...(sets.get(key) ?? [])];
    },
    async rank(key, member, score) {
      const table = ranks.get(key) ?? new Map<string, number>();
      table.set(member, score);
      ranks.set(key, table);
    },
    async unrank(key, member) {
      ranks.get(key)?.delete(member);
    },
    async topRanked(key, count) {
      return [...(ranks.get(key) ?? new Map())]
        .map(([member, score]) => ({ member, score: Number(score) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, count);
    },
    async rankedCount(key) {
      return ranks.get(key)?.size ?? 0;
    },
  };
}

function redisBackend(redis: Redis): Backend {
  return {
    async get(key) {
      return redis.get(key);
    },
    async set(key, value) {
      await redis.set(key, value);
    },
    async setIfAbsent(key, value) {
      // Redis SET NX is atomic across every instance, which is the whole reason
      // this exists rather than a get-then-set in application code.
      const result = await redis.set(key, value, { nx: true });
      return result === "OK";
    },
    async remove(key) {
      await redis.del(key);
    },
    async addToSet(key, member) {
      await redis.sadd(key, member);
    },
    async removeFromSet(key, member) {
      await redis.srem(key, member);
    },
    async setMembers(key) {
      return redis.smembers(key);
    },
    async rank(key, member, score) {
      await redis.zadd(key, { score, member });
    },
    async unrank(key, member) {
      await redis.zrem(key, member);
    },
    async topRanked(key, count) {
      const flat = (await redis.zrange(key, 0, Math.max(count - 1, 0), {
        rev: true,
        withScores: true,
      })) as unknown[];

      // zrange withScores returns a flat [member, score, member, score, ...].
      const out: { member: string; score: number }[] = [];
      for (let i = 0; i < flat.length; i += 2) {
        out.push({ member: String(flat[i]), score: Number(flat[i + 1]) });
      }
      return out;
    },
    async rankedCount(key) {
      return redis.zcard(key);
    },
  };
}

/**
 * Redis credentials, under whichever name they arrived.
 *
 * Two conventions exist for the same Upstash database and they do not agree:
 *
 *   - Upstash's own SDK expects UPSTASH_REDIS_REST_URL / _TOKEN
 *   - Vercel's Upstash integration injects KV_REST_API_URL / KV_REST_API_TOKEN
 *
 * Reading only one of them is a silent, expensive failure: the app boots
 * happily, falls back to memory, and quietly forgets every score whenever the
 * serverless instance recycles. Nobody notices until a user says their result
 * disappeared. So accept both.
 *
 * KV_REST_API_READ_ONLY_TOKEN is deliberately ignored. Writes must work.
 */
function credentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

let backend: Backend | null = null;

function db(): Backend {
  if (backend) return backend;

  const creds = credentials();
  backend = creds ? redisBackend(new Redis(creds)) : memoryBackend();
  return backend;
}

/** True when profiles are actually being persisted. Surfaced on the health route. */
export function isPersistent(): boolean {
  return credentials() !== null;
}

/**
 * A round trip against the real store, so a health check cannot be fooled by
 * config alone. Reports WHY it failed: a bare false told us writes were broken
 * in production and nothing about which call threw, which is useless at exactly
 * the moment it matters.
 */
export async function storeSelfTest(): Promise<{ ok: boolean; failedAt?: string; error?: string }> {
  const key = `${PREFIX}:healthcheck`;
  const stamp = Date.now().toString();

  try {
    await db().set(key, { stamp });
  } catch (error) {
    return { ok: false, failedAt: "set", error: describe(error) };
  }

  let back: unknown;
  try {
    back = await db().get(key);
  } catch (error) {
    return { ok: false, failedAt: "get", error: describe(error) };
  }

  try {
    const parsed = typeof back === "string" ? JSON.parse(back) : back;
    const seen = (parsed as { stamp?: string } | null)?.stamp;
    if (seen !== stamp) {
      return { ok: false, failedAt: "compare", error: `wrote "${stamp}", read back ${JSON.stringify(back)}` };
    }
  } catch (error) {
    return { ok: false, failedAt: "parse", error: describe(error) };
  }

  try {
    await db().rank(`${PREFIX}:healthcheck:rank`, "probe", 1);
  } catch (error) {
    // Ranking uses sorted sets rather than plain keys, so it can fail on its own.
    return { ok: false, failedAt: "rank", error: describe(error) };
  }

  return { ok: true };
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export function newProfileId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * A short, shareable code. Ambiguous characters are left out so it survives
 * being read aloud, retyped from a screenshot, or passed around on WhatsApp.
 */
function newReferralCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function getProfile(id: string): Promise<Profile | null> {
  const raw = await db().get(profileKey(id));
  if (!raw) return null;
  // Upstash returns parsed JSON; the memory backend returns the object as-is.
  return (typeof raw === "string" ? (JSON.parse(raw) as Profile) : (raw as Profile)) ?? null;
}

export async function saveProfile(profile: Profile): Promise<void> {
  await db().set(profileKey(profile.id), profile);
}

/**
 * Erase everything we hold about one profile — the right to be forgotten.
 *
 * Removes the profile itself, its public username and referral-code lookups, its
 * place on the leaderboard, and its entries in the per-account identity index,
 * and stops it counting toward the referrer who brought them. Nothing is left
 * that could rebuild the person's score or presence.
 *
 * Session links are not chased down (there is no reverse index, and a link that
 * points at a now-deleted profile simply resolves to "no profile" — an empty
 * score — on the next request). The delete route drops the caller's own cookie
 * so their browser starts clean regardless.
 */
export async function deleteProfile(profileId: string): Promise<void> {
  const profile = await getProfile(profileId);
  if (!profile) return;

  await db().unrank(RANK_KEY, profileId);
  await db().remove(codeKey(profile.referralCode));
  if (profile.username) await db().remove(usernameKey(profile.username));

  for (const [source, record] of Object.entries(profile.sources)) {
    if (record.externalId) {
      await db().removeFromSet(identityKey(source as SourceId, record.externalId), profileId);
    }
  }

  if (profile.referredBy) {
    await db().removeFromSet(invitedKey(profile.referredBy), profileId);
    await db().removeFromSet(qualifiedKey(profile.referredBy), profileId);
  }

  await db().remove(profileKey(profileId));
}

/** Every underlying account a profile has connected, as `source:id` strings. */
function accountKeys(profile: Profile): string[] {
  return Object.entries(profile.sources)
    .map(([source, record]) => (record.externalId ? `${source}:${record.externalId.toLowerCase()}` : null))
    .filter((key): key is string => key !== null);
}

/**
 * Do these two profiles belong to the same human?
 *
 * This is what closes self-referral. Blocking it within one browser is easy and
 * was already done, but somebody with two Google accounts could open their own
 * link in a second browser, sign in as "someone else", and collect a share off
 * themselves. Laborious, and at these stakes worth somebody's afternoon.
 *
 * The giveaway is the accounts underneath. A person has one YouTube channel and
 * one GitHub username, and connecting the same one on both sides means both
 * sides are the same person. Two genuinely different people cannot collide here
 * because they do not share accounts.
 *
 * Worth noting this also catches the case where somebody pastes a public
 * profile URL they do not own: if two profiles claim the same channel, neither
 * earns a referral off the other.
 */
async function sharesAnAccountWith(profile: Profile, otherId: string): Promise<boolean> {
  const other = await getProfile(otherId);
  if (!other) return false;

  const mine = new Set(accountKeys(profile));
  return accountKeys(other).some((key) => mine.has(key));
}

/** Fetch or create the profile for a session, minting a referral code once. */
export async function ensureProfile(profileId: string, referredBy?: string): Promise<Profile> {
  const existing = await getProfile(profileId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const profile: Profile = {
    id: profileId,
    createdAt: now,
    updatedAt: now,
    sources: {},
    referralCode: newReferralCode(),
    score: 0,
    referrals: 0,
    // A referral is recorded at creation and never rewritten, so someone cannot
    // be reassigned to a different referrer later.
    ...(referredBy ? { referredBy } : {}),
  };

  await saveProfile(profile);
  await db().set(codeKey(profile.referralCode), profile.id);
  if (referredBy) await db().addToSet(invitedKey(referredBy), profile.id);

  return profile;
}

export async function profileIdForCode(code: string): Promise<string | null> {
  const id = await db().get(codeKey(code));
  return typeof id === "string" ? id : null;
}

/** Total invited, and how many turned out to be real enough to count. */
export async function referralTally(code: string): Promise<{ invited: number; qualified: number }> {
  const [invited, qualified] = await Promise.all([
    db().setMembers(invitedKey(code)),
    db().setMembers(qualifiedKey(code)),
  ]);
  return { invited: invited.length, qualified: qualified.length };
}

/**
 * Record one successful read against a profile, creating it if this is the
 * person's first source.
 */
export async function recordSource(
  profileId: string,
  source: SourceId,
  record: SourceRecord,
  scoreAfter: number,
  referredBy?: string,
): Promise<Profile> {
  const profile = await ensureProfile(profileId, referredBy);

  profile.sources[source] = record;
  profile.updatedAt = new Date().toISOString();
  profile.score = scoreAfter;

  // Older profiles minted before referrals were cached may lack the field.
  if (typeof profile.referrals !== "number") profile.referrals = 0;

  await saveProfile(profile);
  await db().rank(RANK_KEY, profile.id, leaguePoints(profile.score, profile.referrals));

  // Index the underlying account so the same person cannot be counted twice.
  if (record.externalId) {
    await db().addToSet(identityKey(source, record.externalId), profileId);
  }

  // Credit the referrer only once this person clears the bar. Adding to a set is
  // idempotent, so crossing the line twice cannot inflate anyone's tally.
  if (profile.referredBy && scoreAfter >= REFERRAL_QUALIFIES_AT) {
    const referrerId = await profileIdForCode(profile.referredBy);
    const legitimate =
      referrerId !== null &&
      referrerId !== profile.id &&
      !(await sharesAnAccountWith(profile, referrerId));

    if (legitimate) {
      const before = await db().setMembers(qualifiedKey(profile.referredBy));
      await db().addToSet(qualifiedKey(profile.referredBy), profile.id);

      // Only re-rank when this is genuinely new, since the set is idempotent
      // and re-counting on every subsequent read would be wasted work.
      if (!before.includes(profile.id)) {
        const referrer = await getProfile(referrerId);
        if (referrer) {
          referrer.referrals = before.length + 1;
          referrer.updatedAt = new Date().toISOString();
          await saveProfile(referrer);
          // Their points just went up, so their place has to move with it.
          await db().rank(
            RANK_KEY,
            referrer.id,
            leaguePoints(referrer.score, referrer.referrals ?? 0),
          );
        }
      }
    }
  }

  return profile;
}

/**
 * Every profile that has claimed this same external account. More than one
 * means somebody connected the same account from different browser sessions,
 * which is worth knowing before any reward is split.
 */
export async function profilesClaiming(source: SourceId, externalId: string): Promise<string[]> {
  return db().setMembers(identityKey(source, externalId));
}

/**
 * The standings the reward is actually paid against.
 *
 * Returns the ranked profile ids with their scores, highest first. Sources of
 * truth for the eventual payout, so it reads from the index rather than
 * recomputing scores, which keeps it consistent with what people were shown.
 */
export async function topProfiles(count: number): Promise<{ id: string; score: number }[]> {
  const rows = await db().topRanked(RANK_KEY, count);
  return rows.map((row) => ({ id: row.member, score: row.score }));
}

/**
 * Attach this browser to a stable identity, absorbing what it had collected.
 *
 * The identity comes from Google sign-in, whose `sub` is the same on every
 * device a person owns. That is the whole point: without it, a phone and a
 * laptop are two profiles with two partial scores and two rows in the
 * standings.
 *
 * Safe to call on every sign-in. The second time through there is usually
 * nothing to absorb and it simply points the session at the existing profile.
 */
export async function claimProfile(
  sessionId: string,
  identityId: string,
  rescore: (evidence: Evidence) => number,
): Promise<Profile> {
  const currentId = await resolveProfileId(sessionId);
  const [existing, current] = await Promise.all([
    getProfile(identityId),
    currentId === identityId ? Promise.resolve(null) : getProfile(currentId),
  ]);

  const now = new Date().toISOString();
  const profile: Profile = existing ?? {
    id: identityId,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    sources: {},
    referralCode: current?.referralCode ?? newReferralCode(),
    score: 0,
    referrals: current?.referrals ?? 0,
    ...(current?.referredBy ? { referredBy: current.referredBy } : {}),
  };

  if (current) {
    for (const [source, record] of Object.entries(current.sources)) {
      // Anything already on the identity wins: it is what this person has been
      // shown, and overwriting it would move their score for no reason.
      if (!profile.sources[source as SourceId]) {
        profile.sources[source as SourceId] = record;
      }
    }
    if (!profile.referredBy && current.referredBy) profile.referredBy = current.referredBy;
    if (!profile.username && current.username) profile.username = current.username;
    if (current.createdAt < profile.createdAt) profile.createdAt = current.createdAt;

    // A referral link already handed out has to keep working.
    if (current.referralCode !== profile.referralCode) {
      await db().set(codeKey(current.referralCode), profile.id);
    }
    await db().unrank(RANK_KEY, current.id);
  }

  profile.score = rescore(evidenceOf(profile));
  if (typeof profile.referrals !== "number") profile.referrals = 0;
  profile.updatedAt = now;

  await saveProfile(profile);
  await db().set(codeKey(profile.referralCode), profile.id);
  await db().set(linkKey(sessionId), profile.id);
  if (profile.username) await db().set(usernameKey(profile.username), profile.id);
  await db().rank(RANK_KEY, profile.id, leaguePoints(profile.score, profile.referrals));

  return profile;
}

/**
 * Look up a profile by the name shown publicly. Null when nobody holds it.
 *
 * Memoised per request. The card page needs the same profile twice — once in
 * `generateMetadata` and once in the page body — and each call is two round
 * trips (name → id, then id → profile). Sharing one result across the request
 * halves the store traffic on the page that receives the most of it, since
 * every chat-app link preview hits it too.
 *
 * `cache` is request-scoped, so this is deduplication and not caching: two
 * visitors never see each other's result, and a profile updated between
 * requests is read fresh.
 */
export const profileByUsername = cache(async (name: string): Promise<Profile | null> => {
  const id = await db().get(usernameKey(name));
  if (typeof id !== "string" || id === "") return null;
  return getProfile(id);
});

/**
 * Names nobody may claim.
 *
 * A leaderboard row reading "patina" or "admin", or a card at /u/support, is a
 * ready-made impersonation for anyone wanting to run a fake payout. The reward
 * terms promise we will never ask for a seed phrase; a convincing account name
 * is most of what somebody would need to make that promise hard to trust.
 */
const RESERVED = new Set([
  "patina",
  "vana",
  "admin",
  "administrator",
  "root",
  "support",
  "help",
  "official",
  "team",
  "staff",
  "mod",
  "moderator",
  "system",
  "security",
  "billing",
  "payout",
  "rewards",
  "reward",
  "standings",
  "connect",
  "api",
  "login",
  "null",
  "undefined",
  "anonymous",
]);

/** Shape rules kept in one place so the API and the form cannot disagree. */
export function usernameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return "At least 3 characters.";
  if (trimmed.length > 20) return "20 characters at most.";
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return "Letters, numbers and underscores only.";
  if (RESERVED.has(trimmed.toLowerCase())) return "That one is reserved. Pick another.";
  return null;
}

/**
 * Claim a username, first come first served.
 *
 * Returns the reason it failed rather than throwing, because every failure here
 * is something the person can fix by typing something else.
 */
export async function setUsername(
  profileId: string,
  name: string,
): Promise<{ ok: true; username: string } | { ok: false; reason: string }> {
  const problem = usernameProblem(name);
  if (problem) return { ok: false, reason: problem };

  const username = name.trim();

  const profile = await getProfile(profileId);
  if (!profile) return { ok: false, reason: "Connect a source first." };

  const alreadyMine = profile.username?.toLowerCase() === username.toLowerCase();

  /**
   * Claim it atomically, or find out who has it.
   *
   * This was a `get` followed by a `set`, which is a race with a real outcome:
   * two people submitting the same name in the same moment both saw it free and
   * both wrote, so the second quietly took a name the first had been told was
   * theirs. `setIfAbsent` is a single SET NX, so exactly one of them wins.
   */
  if (!alreadyMine) {
    const won = await db().setIfAbsent(usernameKey(username), profileId);

    if (!won) {
      const holder = await db().get(usernameKey(username));

      // An empty value is a name released by an older rename, before releases
      // deleted the key. Those are free, and taking one is safe because a
      // second claimant would have lost the SET NX above.
      if (holder === "") {
        await db().set(usernameKey(username), profileId);
      } else if (holder !== profileId) {
        return { ok: false, reason: "Somebody already has that one." };
      }
    }
  }

  // Release the old name so it is not held forever by someone who renamed.
  // Deleted rather than blanked, so the SET NX above is the only gate a future
  // claimant has to pass.
  if (profile.username && profile.username.toLowerCase() !== username.toLowerCase()) {
    await db().remove(usernameKey(profile.username));
  }

  profile.username = username;
  profile.updatedAt = new Date().toISOString();

  await saveProfile(profile);

  return { ok: true, username };
}

/**
 * The standings, with just enough on each row to be worth looking at.
 *
 * Deliberately anonymous. We hold usernames and channel ids for deduplication,
 * and publishing them would expose somebody's accounts to anyone who visited a
 * page, which is the opposite of what this product claims to be for. A rank, a
 * score and a shape is enough to be competitive.
 *
 * Points are ALWAYS derived from the profile (`score + 10 × referrals`), never
 * trusted from the ranked index alone. The index can go stale across deploys
 * that change the ranking formula; the profile cannot lie about its own fields
 * the same way. So the rows below are built from profiles, and a stale index
 * can only affect WHICH profiles are fetched, never what they are shown as.
 *
 * WHAT THIS NO LONGER DOES, and must not do again: it used to call
 * `reconcileRankings` first, on every request. That is one sequential
 * `getProfile` for every ranked profile in the system, on a `force-dynamic`
 * page, for every visitor. At a thousand users that is a thousand round trips
 * to Upstash to render one page — the page times out, and the bill grows with
 * views × users rather than with either one. Reconciliation is a migration, so
 * it now runs as one (see `reconcileRankings`).
 */
export async function standings(
  count: number,
  rescore?: (evidence: Evidence) => number,
): Promise<
  {
    id: string;
    points: number;
    score: number;
    referrals: number;
    sources: number;
    oldestYear: number | null;
    username?: string;
  }[]
> {
  // Fetch a margin beyond `count` so a stale index cannot push a genuinely
  // top-`count` profile off the page, then re-sort on the truth below.
  const top = await topProfiles(Math.max(count * 2, 120));
  const profiles = await Promise.all(top.map((row) => getProfile(row.id)));

  const rows = top
    .map((row, index) => {
      const profile = profiles[index];
      if (!profile) return null;

      // `rescore` recomputes from stored evidence, so a change to the score
      // formula shows up here immediately rather than waiting for a migration.
      // Read-only: nothing is written back on a page render.
      const score = rescore ? rescore(evidenceOf(profile)) : profile.score;
      const referrals = profile.referrals ?? 0;
      const points = leaguePoints(score, referrals);

      const dates = Object.values(profile.sources)
        .flatMap((record) => [
          record.evidence.youtube?.joinedDate,
          record.evidence.github?.createdAt,
          ...(record.evidence.instagramPosts?.posts ?? []).map((post) => post.taken_at),
        ])
        .filter((value): value is string => typeof value === "string")
        .map((value) => new Date(value).getTime())
        .filter((time) => Number.isFinite(time));

      return {
        id: row.id,
        points,
        score,
        referrals,
        sources: Object.keys(profile.sources).length,
        oldestYear: dates.length ? new Date(Math.min(...dates)).getUTCFullYear() : null,
        username: profile.username,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.points - a.points || b.score - a.score);

  return rows.slice(0, count);
}

/**
 * Rewrite every ranked entry from the profile itself.
 *
 * Needed whenever the ranking formula changes (points = score + 10×refs) or a
 * score formula changes (Continuity → Corroboration): old zset values otherwise
 * keep people at impossible pairs like "score 78 / points 2".
 *
 * Optional `rescore` recomputes the Patina score from stored evidence, so a
 * formula change heals without asking everyone to reconnect.
 *
 * THIS IS A MIGRATION, NOT A PAGE HELPER. It touches every profile in the
 * system, one at a time, and writes back the ones that drifted. Calling it to
 * render a page — which the standings page did, on every request — makes the
 * cost of one page view scale with the size of the whole user base. Run it from
 * `/api/admin/reconcile` after a formula change and not otherwise; the
 * standings page derives its numbers from profiles directly, so it stays
 * correct in the meantime whether or not this has run.
 */
export async function reconcileRankings(
  rescore?: (evidence: Evidence) => number,
): Promise<number> {
  const total = await db().rankedCount(RANK_KEY);
  if (total === 0) return 0;

  const rows = await db().topRanked(RANK_KEY, total);
  let fixed = 0;

  for (const row of rows) {
    const profile = await getProfile(row.member);
    if (!profile) {
      await db().unrank(RANK_KEY, row.member);
      fixed += 1;
      continue;
    }

    const liveScore = rescore ? rescore(evidenceOf(profile)) : profile.score;
    const referrals = profile.referrals ?? 0;
    const points = leaguePoints(liveScore, referrals);

    const scoreDrift = liveScore !== profile.score;
    const refsDrift = profile.referrals !== referrals;
    const rankDrift = points !== row.score;

    if (scoreDrift || refsDrift || rankDrift) {
      profile.score = liveScore;
      profile.referrals = referrals;
      profile.updatedAt = new Date().toISOString();
      await saveProfile(profile);
      await db().rank(RANK_KEY, profile.id, points);
      fixed += 1;
    }
  }

  return fixed;
}

/** Test-only: write a raw ranked value so reconcile can be proven to heal it. */
export async function forceRankForTests(profileId: string, points: number): Promise<void> {
  await db().rank(RANK_KEY, profileId, points);
}

/** How many people have a score at all. Shown publicly as "N people so far". */
export async function scoredProfileCount(): Promise<number> {
  return db().rankedCount(RANK_KEY);
}

/**
 * Where one profile sits, and whether that is currently inside the paying
 * places. Recomputed from the index rather than stored, so it cannot go stale.
 */
export async function standingOf(
  profileId: string,
  places: number,
): Promise<{ rank: number | null; inTheMoney: boolean; total: number }> {
  const [total, top] = await Promise.all([
    scoredProfileCount(),
    // Fetch a little past the cut so a profile just outside still gets a number.
    db().topRanked(RANK_KEY, Math.max(places * 4, 200)),
  ]);

  const index = top.findIndex((row) => row.member === profileId);
  const rank = index === -1 ? null : index + 1;

  return { rank, inTheMoney: rank !== null && rank <= places, total };
}

/** Merge every stored source into the single evidence object the scorer wants. */
export function evidenceOf(profile: Profile): Evidence {
  return Object.values(profile.sources).reduce<Evidence>(
    (all, record) => ({ ...all, ...record.evidence }),
    {},
  );
}
