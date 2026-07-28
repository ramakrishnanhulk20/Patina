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
  Evidence,
  GitHubProfile,
  InstagramPosts,
  InstagramProfile,
  SpotifyProfile,
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

export function normalizeInstagramPosts(raw: unknown): InstagramPosts | undefined {
  const posts = listOf(raw, "posts");
  const source = posts.length ? posts : (payloadOf(raw) ? [] : []);
  if (!source.length) return undefined;

  return {
    posts: source.map((post) => ({
      taken_at: pick(post, ["taken_at", "takenAt", "timestamp", "created_at"], isStr),
      num_of_likes: pick(post, ["num_of_likes", "numOfLikes", "like_count", "likes"], isNum),
      caption: pick(post, ["caption"], isStr),
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
    case "instagram.posts":
      return pick(p, ["username"], isStr);
    case "spotify.profile":
      return pick(p, ["id"], isStr);
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
    default:
      return evidence;
  }
}
