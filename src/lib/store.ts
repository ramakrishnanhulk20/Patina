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

import { Redis } from "@upstash/redis";
import type { Evidence, SourceId } from "./score";

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
  /** The code that brought them here, if any. Set once and never changed. */
  referredBy?: string;
  /** Cached so counting a referrer's qualified invites does not rescore everyone. */
  score: number;
  /** Set only when someone claims a reward share. Never asked for up front. */
  payoutAddress?: string;
};

/**
 * The score an invited person must reach before their referrer gets credit.
 *
 * Without a bar like this, a reward-bearing referral link is an invitation to
 * farm: register two hundred throwaway accounts, collect two hundred credits.
 * A throwaway scores about 2 and a genuinely young but real person scores about
 * 30, so 20 separates them with room to spare and without punishing anyone for
 * being nineteen.
 */
export const REFERRAL_QUALIFIES_AT = 20;

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
  addToSet(key: string, member: string): Promise<void>;
  setMembers(key: string): Promise<string[]>;
  /** Ranked index. Needed to answer "who is in the top 50" at all. */
  rank(key: string, member: string, score: number): Promise<void>;
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
    async addToSet(key, member) {
      const set = sets.get(key) ?? new Set<string>();
      set.add(member);
      sets.set(key, set);
    },
    async setMembers(key) {
      return [...(sets.get(key) ?? [])];
    },
    async rank(key, member, score) {
      const table = ranks.get(key) ?? new Map<string, number>();
      table.set(member, score);
      ranks.set(key, table);
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
    async addToSet(key, member) {
      await redis.sadd(key, member);
    },
    async setMembers(key) {
      return redis.smembers(key);
    },
    async rank(key, member, score) {
      await redis.zadd(key, { score, member });
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

/** A round trip against the real store, so a health check cannot be fooled by config alone. */
export async function storeSelfTest(): Promise<boolean> {
  try {
    const key = `${PREFIX}:healthcheck`;
    const stamp = Date.now().toString();
    await db().set(key, { stamp });
    const back = await db().get(key);
    const parsed = typeof back === "string" ? JSON.parse(back) : back;
    return (parsed as { stamp?: string } | null)?.stamp === stamp;
  } catch {
    return false;
  }
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

  await saveProfile(profile);
  await db().rank(RANK_KEY, profile.id, scoreAfter);

  // Index the underlying account so the same person cannot be counted twice.
  if (record.externalId) {
    await db().addToSet(identityKey(source, record.externalId), profileId);
  }

  // Credit the referrer only once this person clears the bar. Adding to a set is
  // idempotent, so crossing the line twice cannot inflate anyone's tally.
  if (profile.referredBy && scoreAfter >= REFERRAL_QUALIFIES_AT) {
    await db().addToSet(qualifiedKey(profile.referredBy), profile.id);
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
