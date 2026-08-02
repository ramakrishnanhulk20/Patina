/**
 * Turning what the Personal Server actually returns into something the scorer
 * can trust.
 *
 * This file exists because of a real bug. The JSON Schemas published in
 * PDP-Connect/data-connectors describe the DESKTOP connector's output. Vana's
 * server-side collection path (the one a user gets without installing anything)
 * returns a DIFFERENT SHAPE for the same scope: the payload is wrapped in an
 * `items` array, and several fields are named differently.
 *
 * Observed for `github.profile` via server-side collection on 28 July 2026:
 *
 *   { scope, data: { version, scope, collectedAt,
 *                    data: { items: [ { username, name, publicRepos,
 *                                       createdAt, ... } ] } },
 *     payment: {...} }
 *
 * versus the published schema's `fullName` / `repositoryCount` and no array.
 *
 * So: read defensively, accept both spellings, never assume the array. A field
 * we cannot find becomes undefined and the scorer treats it as absent evidence,
 * which is correct. It must never throw, because a thrown error here means a
 * user who connected successfully sees a broken page.
 */

import type {
  AmazonOrders,
  Evidence,
  GitHubProfile,
  InstagramPosts,
  InstagramProfile,
  LinkedInProfile,
  SpotifyProfile,
  SteamProfile,
  UberTrips,
  YouTubeProfile,
} from "./score";

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Peel the envelope and hand back the record that actually holds the fields.
 *
 * Handles `{ data: { data: { items: [x] } } }`, `{ data: { data: x } }`,
 * `{ data: x }` and a bare `x`, because we have confirmed two of these in the
 * wild and should not be surprised by the others.
 */
function payloadOf(raw: unknown): Json | undefined {
  let node: unknown = raw;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isObject(node)) break;

    if (Array.isArray(node.items)) {
      const first = node.items[0];
      return isObject(first) ? first : undefined;
    }

    // Descend through envelope wrappers, but only while `data` is a container.
    if ("data" in node && (isObject(node.data) || Array.isArray(node.data))) {
      if (Array.isArray(node.data)) {
        const first = node.data[0];
        return isObject(first) ? first : undefined;
      }
      node = node.data;
      continue;
    }

    return node;
  }

  return isObject(node) ? node : undefined;
}

/** All the records in a payload, for scopes that return a list (posts, etc). */
function listOf(raw: unknown, key: string): Json[] {
  let node: unknown = raw;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isObject(node)) return [];
    if (Array.isArray(node[key])) return (node[key] as unknown[]).filter(isObject);
    if (Array.isArray(node.items)) {
      const merged = (node.items as unknown[]).filter(isObject).flatMap((item) =>
        Array.isArray(item[key]) ? (item[key] as unknown[]).filter(isObject) : [],
      );
      if (merged.length) return merged;
    }
    if ("data" in node && isObject(node.data)) {
      node = node.data;
      continue;
    }
    return [];
  }

  return [];
}

/**
 * The envelope's own `items` array, whatever depth it is buried at.
 *
 * Distinct from `listOf`, which looks for a NAMED list inside the payload. Some
 * reads put the records straight into `items` with no wrapper key at all.
 */
function itemsOf(raw: unknown): Json[] {
  let node: unknown = raw;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isObject(node)) return [];
    if (Array.isArray(node.items)) return (node.items as unknown[]).filter(isObject);
    if (Array.isArray(node.data)) return (node.data as unknown[]).filter(isObject);
    if ("data" in node && isObject(node.data)) {
      node = node.data;
      continue;
    }
    return [];
  }

  return [];
}

/** First present value among several possible field spellings. */
function pick<T>(source: Json | undefined, keys: string[], guard: (v: unknown) => v is T): T | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (guard(value)) return value;
  }
  return undefined;
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

export function normalizeGitHub(raw: unknown): GitHubProfile | undefined {
  const p = payloadOf(raw);
  if (!p) return undefined;

  return {
    username: pick(p, ["username", "login"], isStr),
    followers: pick(p, ["followers"], isNum),
    // Server-side says publicRepos; the published desktop schema says repositoryCount.
    repositoryCount: pick(p, ["publicRepos", "repositoryCount", "public_repos"], isNum),
    contributionsLastYear: pick(p, ["contributionsLastYear"], isNum),
    createdAt: pick(p, ["createdAt", "created_at"], isStr),
    totalStars: pick(p, ["totalStars"], isNum),
    organizations: Array.isArray(p.organizations)
      ? (p.organizations as unknown[]).filter(isObject).map((o) => ({ login: String(o.login ?? "") }))
      : undefined,
    achievements: Array.isArray(p.achievements)
      ? (p.achievements as unknown[]).filter(isObject).map((a) => ({ name: String(a.name ?? "") }))
      : undefined,
  };
}

export function normalizeYouTube(raw: unknown): YouTubeProfile | undefined {
  const p = payloadOf(raw);
  if (!p) return undefined;

  return {
    joinedDate: pick(p, ["joinedDate", "joined_date", "createdAt"], isStr),
    subscriberCount: pick(p, ["subscriberCount", "subscriber_count"], isNum),
    viewCount: pick(p, ["viewCount", "view_count"], isNum),
    videoCount: pick(p, ["videoCount", "video_count"], isNum),
    handle: pick(p, ["handle"], isStr),
    channelTitle: pick(p, ["channelTitle", "channel_title", "title"], isStr),
  };
}

export function normalizeInstagramProfile(raw: unknown): InstagramProfile | undefined {
  const p = payloadOf(raw);
  if (!p) return undefined;

  return {
    username: pick(p, ["username"], isStr),
    follower_count: pick(p, ["follower_count", "followerCount", "followers"], isNum),
    following_count: pick(p, ["following_count", "followingCount", "following"], isNum),
    media_count: pick(p, ["media_count", "mediaCount", "posts_count"], isNum),
    is_private: pick(p, ["is_private", "isPrivate"], isBool),
    is_verified: pick(p, ["is_verified", "isVerified"], isBool),
    is_business: pick(p, ["is_business", "isBusiness"], isBool),
  };
}

/** Field names a post's timestamp has been seen under. */
const POST_DATE_KEYS = ["taken_at", "takenAt", "timestamp", "created_at", "createdAt"];

/** Does this record look like a post rather than an envelope? */
function looksLikeAPost(record: Json): boolean {
  return POST_DATE_KEYS.some((key) => isStr(record[key]));
}

export function normalizeInstagramPosts(raw: unknown): InstagramPosts | undefined {
  // A `posts` array is the documented shape. But this is now the scope Age and
  // Corroboration depend on, so a payload that hands back the posts as the
  // envelope's own `items` must not read as "no history": that would silently
  // cost 60 of the 100 points on a read the user already paid for.
  const named = listOf(raw, "posts");
  const source = named.length ? named : itemsOf(raw).filter(looksLikeAPost);
  if (!source.length) return undefined;

  return {
    // Only the timestamp is kept, because only the timestamp is scored (Age and
    // Corroboration). Captions and like counts are deliberately dropped rather
    // than stored: the scorer never reads them, and holding a person's post text
    // would be more than "the few signals behind the score" that we promise.
    posts: source.map((post) => ({
      taken_at: pick(post, POST_DATE_KEYS, isStr),
    })),
  };
}

export function normalizeSpotify(raw: unknown): SpotifyProfile | undefined {
  const p = payloadOf(raw);
  if (!p) return undefined;

  return {
    id: pick(p, ["id"], isStr),
    display_name: pick(p, ["display_name", "displayName"], isStr),
    followers: pick(p, ["followers"], isNum),
  };
}

/** LinkedIn often returns connections as "500+" rather than a number. */
function parseConnections(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/(\d+)/);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

/** Vanity slug from a LinkedIn profile URL, used as the stable account id. */
function linkedInSlug(profileUrl: string | undefined): string | undefined {
  if (!profileUrl) return undefined;
  const match = profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function normalizeLinkedIn(raw: unknown): LinkedInProfile | undefined {
  const p = payloadOf(raw);
  if (!p) return undefined;

  const profileUrl = pick(p, ["profileUrl", "profile_url", "url"], isStr);
  const connections =
    parseConnections(p.connections) ??
    parseConnections(p.connectionCount) ??
    pick(p, ["connectionCount", "connectionsCount"], isNum);

  // Refuse an empty object: a failed scrape that returns {} would otherwise
  // claim the LinkedIn slot and block a later good read.
  if (!profileUrl && !pick(p, ["fullName", "full_name", "name"], isStr) && connections === undefined) {
    return undefined;
  }

  return {
    profileUrl,
    fullName: pick(p, ["fullName", "full_name", "name"], isStr),
    headline: pick(p, ["headline"], isStr),
    location: pick(p, ["location"], isStr),
    connections,
    about: pick(p, ["about", "summary"], isStr),
    // Not in the published schema; keep the door open the way GitHub's createdAt works.
    createdAt: pick(p, ["createdAt", "created_at", "joinedDate", "joined_date"], isStr),
  };
}

/** Parse a value that may be an ISO string or a unix timestamp into an ISO date. */
function toIsoDate(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value; // seconds vs milliseconds
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

/** The oldest date across a list of records, trying several field spellings. */
function earliestIso(items: Json[], keys: string[]): string | undefined {
  let earliest: number | null = null;
  for (const item of items) {
    for (const key of keys) {
      const iso = toIsoDate(item[key]);
      if (iso) {
        const t = new Date(iso).getTime();
        if (earliest === null || t < earliest) earliest = t;
      }
    }
  }
  return earliest === null ? undefined : new Date(earliest).toISOString();
}

/** First non-empty raw value among several field spellings. */
function firstDefined(source: Json | undefined, keys: string[]): unknown {
  if (!source) return undefined;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

/**
 * Amazon, Uber, Steam — desktop-collected. We keep only the derived signals
 * (oldest date, a count), never the raw orders or trips. Read defensively: the
 * real payload shape is only truly known once one is captured, exactly as with
 * the web sources above.
 */
export function normalizeAmazonOrders(raw: unknown): AmazonOrders | undefined {
  const orders = listOf(raw, "orders");
  if (!orders.length) return undefined;
  return {
    earliestOrder: earliestIso(orders, ["orderDate", "order_date", "date"]),
    orderCount: orders.length,
  };
}

export function normalizeUberTrips(raw: unknown): UberTrips | undefined {
  const trips = listOf(raw, "trips");
  if (!trips.length) return undefined;
  return {
    earliestTrip: earliestIso(trips, ["requestTime", "request_time", "dropoffTime", "date"]),
    tripCount: trips.length,
  };
}

export function normalizeSteam(raw: unknown): SteamProfile | undefined {
  const p = payloadOf(raw);
  if (!p) return undefined;

  const steamId = pick(p, ["steamId", "steam_id", "steamid"], isStr);
  const personaName = pick(p, ["personaName", "persona_name", "personaname"], isStr);
  const accountCreated = toIsoDate(
    firstDefined(p, ["accountCreated", "account_created", "timecreated", "created"]),
  );
  const steamLevel = pick(p, ["steamLevel", "steam_level", "level"], isNum);

  // Refuse an empty read so it does not claim the slot and block a better one.
  if (!steamId && !personaName && !accountCreated) return undefined;

  return { steamId, personaName, accountCreated, steamLevel };
}

/**
 * A stable id for the ACCOUNT behind a read.
 *
 * This is how the reward split stays honest. Wallets and cookies are free to
 * make, so neither can stop one person claiming several shares. The underlying
 * YouTube channel or GitHub username cannot be duplicated, which makes it the
 * only key worth counting on.
 */
export function identityOf(scope: string, raw: unknown): string | undefined {
  const p = payloadOf(raw);
  if (!p) return undefined;

  switch (scope) {
    case "github.profile":
      return pick(p, ["username", "login"], isStr);
    case "youtube.profile":
      return pick(p, ["channelId", "handle", "channelUrl", "email"], isStr);
    case "instagram.profile":
      return pick(p, ["username"], isStr);
    case "instagram.posts": {
      // A posts payload may put the account on the envelope rather than on each
      // record, and `payloadOf` can legitimately land on the first POST, which
      // carries no account at all. Without an id here the same Instagram
      // account connected twice is invisible to the self-referral check, so it
      // is worth looking in both places.
      const direct = pick(p, ["username", "owner", "ownerUsername", "user"], isStr);
      if (direct) return direct;
      for (const item of itemsOf(raw)) {
        const owned = pick(item, ["username", "owner", "ownerUsername", "user"], isStr);
        if (owned) return owned;
      }
      return undefined;
    }
    case "spotify.profile":
      return pick(p, ["id"], isStr);
    case "steam.profile":
      // steamId is the stable account id. Amazon orders and Uber trips carry no
      // account id in the payload; they are collected from a real logged-in
      // account, so there is no externalId to dedup on here (undefined).
      return pick(p, ["steamId", "steam_id", "steamid"], isStr);
    case "linkedin.profile": {
      const url = pick(p, ["profileUrl", "profile_url", "url"], isStr);
      return linkedInSlug(url) ?? pick(p, ["vanityName", "publicIdentifier", "username"], isStr);
    }
    default:
      return undefined;
  }
}

/**
 * Fold one approved read into the evidence we score from.
 *
 * `scope` is the canonical scope string the Personal Server reported, which is
 * more reliable than whatever the caller thought it asked for.
 */
export function foldRead(evidence: Evidence, scope: string, raw: unknown): Evidence {
  switch (scope) {
    case "github.profile":
      return { ...evidence, github: normalizeGitHub(raw) ?? evidence.github };
    case "youtube.profile":
      return { ...evidence, youtube: normalizeYouTube(raw) ?? evidence.youtube };
    case "instagram.profile":
      return { ...evidence, instagram: normalizeInstagramProfile(raw) ?? evidence.instagram };
    case "instagram.posts":
      return { ...evidence, instagramPosts: normalizeInstagramPosts(raw) ?? evidence.instagramPosts };
    case "spotify.profile":
      return { ...evidence, spotify: normalizeSpotify(raw) ?? evidence.spotify };
    case "linkedin.profile":
      return { ...evidence, linkedin: normalizeLinkedIn(raw) ?? evidence.linkedin };
    case "amazon.orders":
      return { ...evidence, amazon: normalizeAmazonOrders(raw) ?? evidence.amazon };
    case "uber.trips":
      return { ...evidence, uber: normalizeUberTrips(raw) ?? evidence.uber };
    case "steam.profile":
      return { ...evidence, steam: normalizeSteam(raw) ?? evidence.steam };
    default:
      return evidence;
  }
}
