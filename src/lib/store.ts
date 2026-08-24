/**
 * Where a person's proof lives between visits.
 *
 * Two things force this to be real storage rather than memory:
 *
 *  1. Vercel throws away memory between requests, so anything in a module-level
 *     Map is gone by the time the user comes back.
 *  2. A grant is bound to the (user, app, source) triple, so approving a second
 *     source REPLACES the first one's scopes. There is exactly one chance to
 *     read each source, and losing that read means losing it for good.
 *
 * WHAT CHANGED IN v2.
 *
 * Reads are stored as FRAGMENTS KEYED BY SCOPE, never as merged evidence. A
 * source now arrives as up to four scopes and reads get retried; merging on
 * write means a retry adds the same months and vouches twice, and somebody's
 * score quietly inflates every time their connection stutters. Keyed by scope,
 * a re-read overwrites and the arithmetic lands identically every time.
 *
 * Identity is the PERSONAL SERVER, not a cookie and not a Google account. Every
 * approval hands back the URL of the user's own Personal Server, which is stable
 * across every device they own and arrives free with data we already asked for.
 * It replaces both the session-cookie default (which made one person on a phone
 * and a laptop into two people) and the Google sign-in that was bolted on to fix
 * that. It is stored only as a keyed hash: it is a locator for somebody's
 * personal data and we have no business holding the real thing.
 *
 * The competition machinery is gone. Referral codes, invite qualification,
 * league points, the ranked leaderboard and the reward reconciliation were all
 * built for a contest that has ended. Roughly six hundred lines of it have been
 * removed rather than left dormant, because dormant code that mints codes and
 * writes index keys is worse than no code at all.
 *
 * Upstash is used in production. Locally, or before the Redis credentials
 * exist, it falls back to an in-process Map so the app still runs end to end.
 * The fallback announces itself once rather than pretending everything is fine.
 */

import { createHmac } from "node:crypto";
import { Redis } from "@upstash/redis";
import { evidenceFrom, type Fragment } from "./normalize.ts";
import { scorePatina, type Evidence, type SourceId } from "./score.ts";

/**
 * v2, so nothing written by v1 is ever read.
 *
 * No score written before desktop collection was ownership-verified, and none of
 * them carry the per-item timestamps v2 scores on. Migrating them would mean
 * showing people a number that dropped for reasons they cannot see. A new
 * prefix orphans the old keys cleanly; they expire or get flushed, and nothing
 * in this file can accidentally read one.
 */
const PREFIX = "patina:v2";

const profileKey = (id: string) => `${PREFIX}:profile:${id}`;
const requestKey = (requestId: string) => `${PREFIX}:request:${requestId}`;
const linkKey = (sessionId: string) => `${PREFIX}:link:${sessionId}`;
const usernameKey = (name: string) => `${PREFIX}:username:${name.toLowerCase()}`;
const serverKey = (hash: string) => `${PREFIX}:server:${hash}`;
const accountKey = (source: SourceId, externalId: string) =>
  `${PREFIX}:account:${source}:${externalId.toLowerCase()}`;

export type SourceRecord = {
  /** When this source was last read in full. */
  readAt: string;
  /** Which scopes actually came back. A source can be partial and still count. */
  scopes: string[];
  /**
   * A stable identifier for the ACCOUNT behind this source (GitHub username,
   * Steam id, and so on). Two profiles claiming the same account is worth
   * noticing: cookies can be cleared, but it is still the same GitHub.
   */
  externalId?: string;
};

export type Profile = {
  id: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Normalised reads, keyed by scope. The merged Evidence is DERIVED from this
   * at scoring time and never stored, so there is exactly one representation of
   * the truth and no way for the two to drift.
   */
  fragments: Record<string, Fragment>;
  sources: Partial<Record<SourceId, SourceRecord>>;
  /** Cached, so rendering a page does not have to rescore. */
  score: number;
  /** Chosen by the person, for their public page. Absent until they pick one. */
  username?: string;
  /** Keyed hash of the Personal Server that proved these reads. */
  serverHash?: string;
};

/** Reassemble the evidence a profile's stored fragments describe. */
export function evidenceOf(profile: Profile): Evidence {
  return evidenceFrom(profile.fragments ?? {});
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

interface Backend {
  get(key: string): Promise<unknown>;
  /** `ttlSeconds`, when given, makes the key expire. Persistent data omits it. */
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  /**
   * Write only if the key is absent. True when this caller won it.
   *
   * The point of contact with reality: claiming a username was a read followed
   * by a write, so two people typing the same name at the same moment both read
   * "free" and both wrote, and the second silently took it from the first.
   */
  setIfAbsent(key: string, value: string): Promise<boolean>;
  remove(key: string): Promise<void>;
}

let warned = false;

function memoryBackend(): Backend {
  const map = new Map<string, unknown>();
  const expiries = new Map<string, number>();

  if (!warned) {
    warned = true;
    console.warn(
      "[patina] No UPSTASH_REDIS_REST_URL configured. Falling back to in-memory storage: " +
        "profiles will not survive a restart. Fine locally, NOT fine in production.",
    );
  }

  return {
    async get(key) {
      const expiry = expiries.get(key);
      if (expiry !== undefined && expiry <= Date.now()) {
        map.delete(key);
        expiries.delete(key);
        return null;
      }
      return map.get(key) ?? null;
    },
    async set(key, value, ttlSeconds) {
      map.set(key, value);
      if (ttlSeconds) expiries.set(key, Date.now() + ttlSeconds * 1000);
      else expiries.delete(key);
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
  };
}

function redisBackend(redis: Redis): Backend {
  return {
    get: (key) => redis.get(key),
    async set(key, value, ttlSeconds) {
      if (ttlSeconds) await redis.set(key, value, { ex: ttlSeconds });
      else await redis.set(key, value);
    },
    async setIfAbsent(key, value) {
      return (await redis.set(key, value, { nx: true })) === "OK";
    },
    async remove(key) {
      await redis.del(key);
    },
  };
}

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
    await db().set(key, { stamp }, 60);
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
    if ((parsed as { stamp?: string } | null)?.stamp !== stamp) {
      return {
        ok: false,
        failedAt: "compare",
        error: `wrote "${stamp}", read back ${JSON.stringify(back)}`,
      };
    }
  } catch (error) {
    return { ok: false, failedAt: "parse", error: describe(error) };
  }

  return { ok: true };
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function parse<T>(raw: unknown): T | null {
  if (!raw) return null;
  // Upstash returns parsed JSON; the memory backend returns the object as-is.
  return (typeof raw === "string" ? (JSON.parse(raw) as T) : (raw as T)) ?? null;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export function newProfileId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * A one-way, keyed hash of a Personal Server URL.
 *
 * Keyed rather than a plain digest, because the set of Personal Server URLs is
 * small and guessable enough that a bare SHA-256 would be reversible by anyone
 * who could enumerate them. Without the secret the stored value is inert.
 *
 * Falls back to the app private key when no dedicated secret is set, so a
 * missing env var degrades to "still hashed, still keyed" rather than to
 * plaintext. It must never be absent, which is why there is no unkeyed branch.
 */
function hashServer(personalServerUrl: string): string {
  const secret =
    process.env.PATINA_IDENTITY_SECRET ?? process.env.VANA_APP_PRIVATE_KEY ?? "patina-dev-secret";
  return createHmac("sha256", secret)
    .update(personalServerUrl.trim().toLowerCase().replace(/\/+$/, ""))
    .digest("hex");
}

/**
 * The profile this browser session should read and write, or null when the
 * session has not been bound to one yet.
 *
 * NEVER falls back to returning the session token. That fallback is what made
 * the profile id and the credential the same string: knowing an id was enough
 * to be treated as its owner, and ids are not secret.
 */
export async function resolveProfileId(sessionId: string): Promise<string | null> {
  const linked = await db().get(linkKey(sessionId));
  return typeof linked === "string" ? linked : null;
}

/**
 * The profile for this session, minting and binding one if it has none.
 *
 * The profile id is generated independently of the session token, so neither
 * can be derived from the other and a published id is not a credential.
 */
export async function ensureProfileId(sessionId: string): Promise<string> {
  const linked = await resolveProfileId(sessionId);
  if (linked) return linked;

  const profileId = newProfileId();
  await db().set(linkKey(sessionId), profileId);
  return profileId;
}

export async function unlinkSession(sessionId: string): Promise<void> {
  await db().remove(linkKey(sessionId));
}

/**
 * The canonical profile for a Personal Server, folding this browser into it.
 *
 * This is what makes a Patina profile follow a person across devices without
 * anybody signing in to anything. The same Vana account always resolves to the
 * same Personal Server, so connecting on a work laptop finds the profile made
 * on a home desktop and continues it.
 *
 * When the browser already had a profile of its own, its reads are folded in
 * rather than discarded, and the server-anchored profile wins any scope they
 * both hold: it is the one actually proven to belong to this Vana account.
 */
export async function profileForServer(
  sessionId: string,
  personalServerUrl: string,
): Promise<string> {
  const hash = hashServer(personalServerUrl);
  const anchored = await db().get(serverKey(hash));
  const local = await resolveProfileId(sessionId);

  if (typeof anchored === "string" && anchored) {
    if (local && local !== anchored) await absorb(local, anchored);
    await db().set(linkKey(sessionId), anchored);
    return anchored;
  }

  const profileId = local ?? (await ensureProfileId(sessionId));
  await db().set(serverKey(hash), profileId);

  /**
   * Materialise the profile now, rather than waiting for the first read.
   *
   * Profiles are otherwise created lazily by `recordSource`, which meant the
   * `serverHash` stamped here landed on nothing and was silently lost. The
   * profile then had no record of its own anchor, so `deleteProfile` could not
   * clear the server key, and the next person to arrive on that Personal Server
   * was handed the id of a profile that no longer existed.
   */
  const existing = await getProfile(profileId);
  await saveProfile(
    existing
      ? { ...existing, serverHash: hash }
      : { ...blankProfile(profileId), serverHash: hash },
  );

  return profileId;
}

function blankProfile(id: string): Profile {
  const now = new Date().toISOString();
  return { id, createdAt: now, updatedAt: now, fragments: {}, sources: {}, score: 0 };
}

/** Fold a browser-local profile into the one its Personal Server proves. */
async function absorb(fromId: string, intoId: string): Promise<void> {
  const [from, into] = await Promise.all([getProfile(fromId), getProfile(intoId)]);
  if (!from || !into) return;

  // The anchored profile wins on conflict; the local one only fills gaps.
  const fragments = { ...from.fragments, ...into.fragments };
  const sources = { ...from.sources, ...into.sources };

  await saveProfile({
    ...into,
    fragments,
    sources,
    score: scorePatina(evidenceFrom(fragments)).total,
    username: into.username ?? from.username,
    updatedAt: new Date().toISOString(),
  });

  await db().remove(profileKey(fromId));
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function getProfile(id: string): Promise<Profile | null> {
  return parse<Profile>(await db().get(profileKey(id)));
}

export async function saveProfile(profile: Profile): Promise<void> {
  await db().set(profileKey(profile.id), profile);
}

async function ensureProfile(id: string): Promise<Profile> {
  return (await getProfile(id)) ?? blankProfile(id);
}

/**
 * Record everything a source returned, and rescore.
 *
 * Idempotent by construction. Fragments are written under their scope key, so
 * calling this twice with the same reads produces byte-identical storage and an
 * identical score. That matters because the data route retries, and because a
 * user refreshing mid-settle should cost them nothing.
 */
export async function recordSource(
  profileId: string,
  source: SourceId,
  reads: Array<{ scope: string; fragment: Fragment }>,
  meta: { externalId?: string } = {},
): Promise<Profile> {
  const profile = await ensureProfile(profileId);

  const fragments = { ...profile.fragments };
  for (const read of reads) fragments[read.scope] = read.fragment;

  const sources = {
    ...profile.sources,
    [source]: {
      readAt: new Date().toISOString(),
      scopes: reads.map((read) => read.scope),
      ...(meta.externalId ? { externalId: meta.externalId } : {}),
    },
  };

  const updated: Profile = {
    ...profile,
    fragments,
    sources,
    score: scorePatina(evidenceFrom(fragments)).total,
    updatedAt: new Date().toISOString(),
  };

  await saveProfile(updated);

  // Note which account this was, so two profiles claiming the same GitHub can be
  // spotted later. Recorded, not enforced: someone genuinely re-doing their own
  // profile on a new browser hits this too, and refusing them would be wrong.
  if (meta.externalId) {
    await db().set(accountKey(source, meta.externalId), profileId);
  }

  return updated;
}

/**
 * Which profile last claimed a given account, if any.
 *
 * A different profile id here means two Patina profiles both say they are the
 * same GitHub. Surfaced for review rather than blocked automatically.
 */
export async function profileIdForAccount(
  source: SourceId,
  externalId: string,
): Promise<string | null> {
  const raw = await db().get(accountKey(source, externalId));
  return typeof raw === "string" ? raw : null;
}

export async function deleteProfile(id: string, sessionId?: string): Promise<void> {
  const profile = await getProfile(id);

  await db().remove(profileKey(id));
  if (sessionId) await unlinkSession(sessionId);
  if (!profile) return;

  if (profile.username) await db().remove(usernameKey(profile.username));
  if (profile.serverHash) await db().remove(serverKey(profile.serverHash));

  for (const [source, record] of Object.entries(profile.sources)) {
    if (record?.externalId) {
      await db().remove(accountKey(source as SourceId, record.externalId));
    }
  }
}

// ---------------------------------------------------------------------------
// Usernames
// ---------------------------------------------------------------------------

/**
 * Underscores are allowed alongside hyphens.
 *
 * They are the older and more widespread username convention, they are safe in
 * a URL path, and somebody whose handle everywhere else is `real_name` should
 * not be told it is invalid here for no reason they can see. Must still start
 * and end alphanumeric, so a name cannot be padded with separators to squat on
 * a near-identical one.
 */
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,20}[a-z0-9])$/;

const RESERVED = new Set([
  "admin", "api", "about", "connect", "docs", "help", "login", "logout", "mcp",
  "patina", "privacy", "settings", "share", "signin", "signup", "support",
  "terms", "u", "verify", "www",
]);

export function usernameProblem(name: string): string | null {
  const value = name.trim().toLowerCase();
  if (value.length < 3) return "A little longer, please. Three characters minimum.";
  if (value.length > 22) return "That is too long. Twenty-two characters maximum.";
  if (!USERNAME_PATTERN.test(value)) {
    return "Letters, numbers, hyphens and underscores only, starting and ending with a letter or number.";
  }
  if (RESERVED.has(value)) return "That one is reserved. Try another.";
  return null;
}

/**
 * Claim a username, or report why not.
 *
 * Uses `setIfAbsent` rather than read-then-write, because two people typing the
 * same name at the same moment both read "free" and both wrote, and the second
 * silently took it from the first.
 */
export async function claimUsername(
  profileId: string,
  name: string,
): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const value = name.trim().toLowerCase();
  const problem = usernameProblem(value);
  if (problem) return { ok: false, error: problem };

  /**
   * The signing floor, enforced HERE rather than only in the UI.
   *
   * It used to live solely in the connect page, which hid the name field for a
   * provisional profile. That is a rule in the button, not a rule in the lock:
   * anything posting straight to /api/patina/username walked past it and got a
   * public page, a badge and a signed attestation for a score Patina had
   * decided not to vouch for. The check belongs at the point of writing, where
   * nothing can route around it.
   */
  const profile = await getProfile(profileId);
  if (!profile || Object.keys(profile.sources).length === 0) {
    return { ok: false, error: "Connect a source before choosing a name." };
  }

  const score = scorePatina(evidenceFrom(profile.fragments ?? {}));
  if (score.provisional) {
    return {
      ok: false,
      error: score.provisionalReason ?? "Connect a source that carries a date first.",
    };
  }

  if (profile.username === value) return { ok: true, username: value };

  const won = await db().setIfAbsent(usernameKey(value), profileId);
  if (!won) {
    const holder = await db().get(usernameKey(value));
    if (holder !== profileId) return { ok: false, error: "That name is taken." };
  }

  // Release the previous one so it does not sit reserved forever.
  if (profile.username) await db().remove(usernameKey(profile.username));

  await saveProfile({ ...profile, username: value, updatedAt: new Date().toISOString() });
  return { ok: true, username: value };
}

export async function profileIdForUsername(name: string): Promise<string | null> {
  const raw = await db().get(usernameKey(name.trim().toLowerCase()));
  return typeof raw === "string" ? raw : null;
}

export async function profileForUsername(name: string): Promise<Profile | null> {
  const id = await profileIdForUsername(name);
  return id ? getProfile(id) : null;
}

// ---------------------------------------------------------------------------
// Requests in flight
// ---------------------------------------------------------------------------

/**
 * An access request in flight.
 *
 * Shared storage rather than a module-level Map: on Vercel the POST that creates
 * the request and the GET that reads the result can land on different instances,
 * so an in-memory map would lose the source and the read would fail after the
 * user had already approved. That is the worst place to drop someone.
 */
export type PendingRequest = {
  source: SourceId;
  profileId: string;
  createdAt: string;
  /**
   * Cached reads, so a replayed request id cannot re-spend escrow. Stored as
   * normalised fragments rather than raw payloads: the raw ones carry captions,
   * addresses and other people's names, and holding those for a day in a cache
   * would undo the entire point of discarding them on arrival.
   */
  reads?: Array<{ scope: string; fragment: Fragment }>;
  /**
   * The account handle behind those reads, captured from the raw payload before
   * normalize discarded it. Cached alongside the reads so a replayed request
   * records the same account rather than losing it.
   */
  externalId?: string;
};

/**
 * A request is a short-lived record of one in-flight connection. After the read
 * is folded into the profile it serves no further purpose, so a day (far longer
 * than any approval takes) is ample. Expiring it also means a cached read cannot
 * outlive the person: a profile deletion has no back-reference to these keys, so
 * the TTL is what clears them.
 */
const REQUEST_TTL_SECONDS = 60 * 60 * 24;

export async function rememberRequest(requestId: string, pending: PendingRequest): Promise<void> {
  await db().set(requestKey(requestId), pending, REQUEST_TTL_SECONDS);
}

export async function getRequest(requestId: string): Promise<PendingRequest | null> {
  return parse<PendingRequest>(await db().get(requestKey(requestId)));
}
