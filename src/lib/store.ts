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
  };
}

let backend: Backend | null = null;

function db(): Backend {
  if (backend) return backend;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  backend = url && token ? redisBackend(new Redis({ url, token })) : memoryBackend();
  return backend;
}

/** True when profiles are actually being persisted. Surfaced on the health route. */
export function isPersistent(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
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

/** Merge every stored source into the single evidence object the scorer wants. */
export function evidenceOf(profile: Profile): Evidence {
  return Object.values(profile.sources).reduce<Evidence>(
    (all, record) => ({ ...all, ...record.evidence }),
    {},
  );
}
