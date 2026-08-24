/**
 * Turning what the Personal Server actually returns into something the scorer
 * can trust, and throwing away everything else on the way through.
 *
 * TWO JOBS, and the second one is the promise the product is built on.
 *
 * 1. SURVIVE THE SHAPE. Vana's payloads do not arrive in one predictable form.
 *    The JSON Schemas in PDP-Connect/data-connectors describe the connector's
 *    output; what reaches us is wrapped in an envelope that has had at least
 *    four observed variants, including one where the whole payload sits inside
 *    an `items[]` array with different field names. Nothing in this file may
 *    ever throw. A field we cannot find becomes undefined, the scorer treats it
 *    as absent evidence, and the person sees a slightly lower score instead of a
 *    broken page.
 *
 * 2. DISCARD ON ARRIVAL. Every scope here is requested for its TIMESTAMPS. The
 *    content that comes attached is not wanted, is not scored, and must not
 *    reach the store. Instagram posts arrive with captions, images, and a
 *    `who_liked[]` array naming everyone who liked them. Uber trips arrive with
 *    the pickup and dropoff address of every journey. YouTube arrives with the
 *    account's email. None of that is persisted, and the tests in
 *    normalize.test.ts fail if any of it ever is.
 *
 * Timestamps collapse to MONTH BUCKETS before they are stored. The scorer only
 * ever asks about months, so holding anything finer would be holding it for no
 * reason, which is exactly what we told people we would not do.
 */

import type { Evidence, Months, SourceEvidence, SourceId } from "./score.ts";

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every scope Patina reads, and which source it belongs to.
 *
 * The single source of truth for the manifest. Anything not listed here is a
 * scope we did not ask for, and a read that comes back with one is ignored
 * rather than guessed at.
 */
export const SCOPE_SOURCE: Record<string, SourceId> = {
  "github.profile": "github",
  "github.contributions": "github",
  "github.history": "github",
  "github.repositories": "github",
  "linkedin.profile": "linkedin",
  "linkedin.connections": "linkedin",
  "linkedin.experience": "linkedin",
  "linkedin.education": "linkedin",
  "spotify.profile": "spotify",
  "spotify.savedTracks": "spotify",
  "spotify.playlists": "spotify",
  "instagram.profile": "instagram",
  "instagram.posts": "instagram",
  "steam.profile": "steam",
  "steam.friends": "steam",
  "steam.games": "steam",
  "youtube.profile": "youtube",
  "amazon.orders": "amazon",
  "uber.trips": "uber",
  "doordash.orders": "doordash",
  "shop.orders": "shop",
};

export const ALL_SCOPES = Object.keys(SCOPE_SOURCE);

/** Every scope Patina asks for, grouped by the source that serves it. */
export const SCOPES_BY_SOURCE = ALL_SCOPES.reduce<Record<SourceId, string[]>>(
  (grouped, scope) => {
    const source = SCOPE_SOURCE[scope];
    (grouped[source] ??= []).push(scope);
    return grouped;
  },
  {} as Record<SourceId, string[]>,
);

// ---------------------------------------------------------------------------
// Unwrapping
// ---------------------------------------------------------------------------

/**
 * Find the record (or array) that actually holds the fields for `scope`.
 *
 * Handles every envelope shape seen so far, in order of how specific they are:
 *
 *   { "github.profile": {...}, requestedScopes: [...] }   connector flat format
 *   { data: { data: { items: [x] } } }                    server-side collection
 *   { data: { data: x } }
 *   { data: x }
 *   x                                                     bare
 *
 * Returns `undefined` rather than throwing when none of them match, because an
 * unrecognised envelope is a source that scores nothing, not an outage.
 */
export function payloadFor(raw: unknown, scope: string): unknown {
  let node: unknown = raw;

  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(node)) return node;
    if (!isObject(node)) break;

    // Connectors key their output by "platform.scope". Check this first: an
    // envelope can contain BOTH a `data` key and the scope key, and the scope
    // key is the more specific answer.
    if (scope in node) {
      const keyed = node[scope];
      if (keyed !== undefined && keyed !== null) return keyed;
    }

    if (Array.isArray(node.items)) {
      const first = node.items[0];
      return isObject(first) ? first : undefined;
    }

    if ("data" in node && node.data !== undefined && node.data !== null) {
      node = node.data;
      continue;
    }

    return node;
  }

  return isObject(node) || Array.isArray(node) ? node : undefined;
}

// ---------------------------------------------------------------------------
// Reading values defensively
// ---------------------------------------------------------------------------

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** First key that exists, because the same field is spelled differently across shapes. */
function pick(node: unknown, ...keys: string[]): unknown {
  if (!isObject(node)) return undefined;
  for (const key of keys) {
    if (node[key] !== undefined && node[key] !== null) return node[key];
  }
  return undefined;
}

/**
 * A Date from whatever the connector felt like sending.
 *
 * Strings are the common case. Steam sends unix SECONDS for account creation
 * where the schema says date-time, and a naive `new Date(1375315200)` is
 * January 1970, which would hand somebody a fifty-six year old account.
 */
function toDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Ten-digit values are seconds; thirteen-digit are milliseconds.
    const ms = value < 1e11 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : sane(date);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : sane(date);
}

/**
 * Reject dates that cannot be true.
 *
 * A parse failure that yields 1970, or a timezone artefact that yields next
 * year, would both feed straight into Age. The web is not older than 1990 and
 * nothing has happened tomorrow.
 */
function sane(date: Date): Date | null {
  const year = date.getUTCFullYear();
  if (year < 1990) return null;
  if (date.getTime() > Date.now() + 86_400_000) return null;
  return date;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    // "500+", "1,234", "12K followers" all appear in real connector output.
    const cleaned = value.replace(/,/g, "").trim();
    const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([KkMm])?/);
    if (!match) return undefined;
    const base = Number(match[1]);
    if (!Number.isFinite(base)) return undefined;
    const suffix = match[2]?.toLowerCase();
    return suffix === "k" ? base * 1_000 : suffix === "m" ? base * 1_000_000 : base;
  }
  return undefined;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Collapse a list of items into a month histogram plus the earliest date seen.
 *
 * This is where the discarding happens: `items` goes in carrying whatever the
 * connector sent, and only counts-per-month come out.
 */
function bucket(items: unknown[], ...dateKeys: string[]): { months: Months; earliest?: Date } {
  const months: Months = {};
  let earliest: Date | undefined;

  for (const item of items) {
    const date = toDate(pick(item, ...dateKeys));
    if (!date) continue;
    const key = monthKey(date);
    months[key] = (months[key] ?? 0) + 1;
    if (!earliest || date < earliest) earliest = date;
  }

  return { months, earliest };
}

/**
 * The earliest plausible year mentioned in a free-text date range.
 *
 * LinkedIn sends experience dates as strings a human typed or a page rendered:
 * "Jan 2015 - Present", "2010 - 2014", "2019 - Present · 6 yrs". There is no
 * structured field, so this is the best available and it is why every date it
 * produces is marked `softDate` and counts at half weight.
 */
function earliestYearIn(text: unknown): Date | null {
  if (typeof text !== "string") return null;
  const years = [...text.matchAll(/\b(19[9]\d|20[0-4]\d)\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 1990 && year <= new Date().getUTCFullYear());
  if (years.length === 0) return null;
  return new Date(Date.UTC(Math.min(...years), 0, 1));
}

// ---------------------------------------------------------------------------
// Per-scope normalisers
//
// Each returns only what survives: dates, month buckets, counts. Everything
// else the connector sent is simply never read, which is the strongest form of
// "we do not store it" available.
// ---------------------------------------------------------------------------

/**
 * What one scope contributes, before it is combined with anything else.
 *
 * Fragments are what gets STORED, keyed by scope. The merged `Evidence` is
 * derived from them at scoring time and never persisted.
 *
 * This is a correctness property, not a preference. Reads get retried: a
 * network blip, a cold instance, a user refreshing the page mid-settle. Merging
 * on arrival means a retry adds the same months and the same vouch counts a
 * second time, and somebody's score quietly inflates every time their
 * connection stutters. Keyed by scope, a re-read REPLACES its fragment and the
 * arithmetic lands identically however many times it runs.
 */
export type Fragment = Partial<SourceEvidence>;

const NORMALIZERS: Record<string, (payload: unknown) => Fragment | undefined> = {
  // --- GitHub ------------------------------------------------------------

  "github.profile": (p) => {
    const followers = toNumber(pick(p, "followers"));
    const orgs = asArray(pick(p, "organizations")).length;
    const badges = asArray(pick(p, "achievements")).length;
    // Somebody else had to let you in, which is worth more per unit than a
    // follower, but carries no date so it counts as an undated vouch.
    const vouches = orgs + badges;
    if (followers === undefined && vouches === 0) return undefined;
    return { ...(followers !== undefined ? { followers } : {}), ...(vouches ? { vouches } : {}) };
  },

  /**
   * The best Continuity signal in the catalogue: up to four years of daily
   * contribution counts, plus per-year totals that reach back further than the
   * daily grid does.
   */
  "github.contributions": (p) => {
    const months: Months = {};

    for (const day of asArray(pick(p, "days"))) {
      const date = toDate(pick(day, "date"));
      const count = toNumber(pick(day, "count")) ?? 0;
      if (!date || count <= 0) continue;
      const key = monthKey(date);
      months[key] = (months[key] ?? 0) + count;
    }

    // monthlyTotals covers the same ground when days[] is absent. Only used as
    // a fallback, never added on top, or every month would be counted twice.
    if (Object.keys(months).length === 0) {
      for (const entry of asArray(pick(p, "monthlyTotals"))) {
        const date = toDate(pick(entry, "month"));
        const count = toNumber(pick(entry, "count")) ?? 0;
        if (!date || count <= 0) continue;
        months[monthKey(date)] = count;
      }
    }

    // yearTotals reaches past the daily grid, so it is the oldest thing this
    // scope can prove. A year with contributions in it means the account
    // existed by January of that year at the latest.
    const years = asArray(pick(p, "yearTotals"))
      .filter((entry) => (toNumber(pick(entry, "total")) ?? 0) > 0)
      .map((entry) => toNumber(pick(entry, "year")))
      .filter((year): year is number => year !== undefined && year >= 1990);

    const earliestFromYears = years.length ? new Date(Date.UTC(Math.min(...years), 0, 1)) : null;
    const earliestFromMonths = Object.keys(months).sort()[0];
    const earliest =
      earliestFromYears ?? (earliestFromMonths ? toDate(`${earliestFromMonths}-01`) : null);

    if (Object.keys(months).length === 0 && !earliest) return undefined;

    return {
      months,
      ...(earliest
        ? { earliest: earliest.toISOString(), earliestLabel: "first GitHub contribution" }
        : {}),
    };
  },

  /**
   * The full lifetime of pull requests and issues, which is the only place a
   * desktop read gets a real GitHub age from. Titles and bodies are never read.
   */
  "github.history": (p) => {
    const items = [...asArray(pick(p, "pullRequests")), ...asArray(pick(p, "issues"))];
    if (items.length === 0) return undefined;

    const { months, earliest } = bucket(items, "createdAt");

    // Comments and reactions received are other people responding to your work.
    // Undated at the item level, so they count as undated vouches.
    const engagement = items.reduce<number>(
      (sum, item) =>
        sum + (toNumber(pick(item, "comments")) ?? 0) + (toNumber(pick(item, "reactionsTotal")) ?? 0),
      0,
    );

    return {
      months,
      ...(earliest
        ? { earliest: earliest.toISOString(), earliestLabel: "first GitHub contribution" }
        : {}),
      made: [{ count: items.length, label: "pull requests and issues" }],
      ...(engagement > 0 ? { vouches: Math.min(engagement, 200) } : {}),
    };
  },

  /**
   * Repository count and stars. Deliberately contributes NO months: `updatedAt`
   * is the last time a repo changed, not when it was made, so a decade-old repo
   * touched yesterday would otherwise register as activity yesterday and
   * nothing before it.
   */
  "github.repositories": (p) => {
    const repos = asArray(pick(p, "repositories"));
    if (repos.length === 0) return undefined;
    return { made: [{ count: repos.length, label: "repos" }] };
  },

  // --- LinkedIn ----------------------------------------------------------

  /**
   * The strongest new signal desktop unlocks. Every connection carries the date
   * it was made, so this measures when other people chose to associate with you
   * rather than how many of them there are.
   *
   * Names, headlines and profile URLs are dropped here and never stored. They
   * belong to people who did not agree to anything.
   */
  "linkedin.connections": (p) => {
    const connections = asArray(pick(p, "connections"));
    if (connections.length === 0) return undefined;
    const { months } = bucket(connections, "dateConnected", "connectedOn", "date");
    if (Object.keys(months).length === 0) return undefined;
    return { vouchMonths: months };
  },

  "linkedin.experience": (p) => {
    const roles = asArray(pick(p, "experiences", "experience"));
    const dates = roles
      .map((role) => earliestYearIn(pick(role, "dates", "dateRange", "duration")))
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) return undefined;
    return {
      earliest: dates[0].toISOString(),
      earliestLabel: "LinkedIn work history",
      softDate: true,
    };
  },

  "linkedin.education": (p) => {
    const schools = asArray(pick(p, "education"));
    const dates = schools
      .map((school) => earliestYearIn(pick(school, "years", "dates", "dateRange")))
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) return undefined;
    return {
      earliest: dates[0].toISOString(),
      earliestLabel: "LinkedIn education history",
      softDate: true,
    };
  },

  "linkedin.profile": (p) => {
    // Arrives as "500+" more often than as a number.
    const followers = toNumber(pick(p, "connections"));
    if (followers === undefined) return undefined;
    return { followers };
  },

  // --- Spotify -----------------------------------------------------------

  /**
   * Spotify goes from a dead source on the web path to one of the best here. A
   * decade of `added_at` timestamps is the cheapest dense Continuity signal in
   * the catalogue. Track names, artists and albums are never read: what somebody
   * listens to is none of Patina's business.
   */
  "spotify.savedTracks": (p) => {
    const tracks = asArray(pick(p, "savedTracks", "items"));
    if (tracks.length === 0) return undefined;
    const { months, earliest } = bucket(tracks, "added_at", "addedAt");
    return {
      months,
      ...(earliest ? { earliest: earliest.toISOString(), earliestLabel: "first saved track" } : {}),
      made: [{ count: toNumber(pick(p, "total")) ?? tracks.length, label: "saved tracks" }],
    };
  },

  "spotify.playlists": (p) => {
    const playlists = asArray(pick(p, "playlists"));
    if (playlists.length === 0) return undefined;

    const tracks = playlists.flatMap((playlist) => asArray(pick(playlist, "tracks")));
    const { months, earliest } = bucket(tracks, "added_at", "addedAt");

    return {
      ...(Object.keys(months).length ? { months } : {}),
      ...(earliest
        ? { earliest: earliest.toISOString(), earliestLabel: "first playlist track" }
        : {}),
      made: [{ count: playlists.length, label: "playlists" }],
    };
  },

  "spotify.profile": (p) => {
    const followers = toNumber(pick(p, "followers"));
    return followers === undefined ? undefined : { followers };
  },

  // --- Instagram ---------------------------------------------------------

  /**
   * Only `taken_at` survives. Captions, images, like counts and the entire
   * `who_liked[]` array are dropped, the last of those being a list of usernames
   * and profile pictures belonging to everyone who ever liked one of these
   * posts. That is a large amount of other people's data arriving as a side
   * effect of asking for a date, and it must not reach the store.
   */
  "instagram.posts": (p) => {
    const posts = asArray(pick(p, "posts"));
    if (posts.length === 0) return undefined;
    const { months, earliest } = bucket(posts, "taken_at", "takenAt", "timestamp");
    return {
      months,
      ...(earliest
        ? { earliest: earliest.toISOString(), earliestLabel: "earliest Instagram post" }
        : {}),
      made: [{ count: posts.length, label: "posts" }],
    };
  },

  "instagram.profile": (p) => {
    const followers = toNumber(pick(p, "follower_count", "followerCount", "followers"));
    const posts = toNumber(pick(p, "media_count", "mediaCount"));
    if (followers === undefined && posts === undefined) return undefined;
    return {
      ...(followers !== undefined ? { followers } : {}),
      // Only used when instagram.posts did not come back; otherwise the posts
      // scope has already counted them and this would double up.
      ...(posts !== undefined ? { made: [{ count: posts, label: "posts" }] } : {}),
    };
  },

  // --- Steam -------------------------------------------------------------

  "steam.profile": (p) => {
    const created = toDate(pick(p, "accountCreated", "timecreated", "createdAt"));
    if (!created) return undefined;
    return { earliest: created.toISOString(), earliestLabel: "Steam account opened" };
  },

  /**
   * `friendSince` is the same class of signal as LinkedIn's `dateConnected`: a
   * timestamped record of another person choosing to associate with you. Persona
   * names and avatars are dropped.
   */
  "steam.friends": (p) => {
    // This one arrives as a bare top-level array in the published schema.
    const friends = Array.isArray(p) ? p : asArray(pick(p, "friends"));
    if (friends.length === 0) return undefined;
    const { months } = bucket(friends, "friendSince", "friend_since");
    if (Object.keys(months).length === 0) return undefined;
    return { vouchMonths: months };
  },

  /**
   * Owned games and their last-played dates. Game names are dropped: a library
   * is a surprisingly precise description of a person.
   */
  "steam.games": (p) => {
    const owned = asArray(pick(p, "owned", "games"));
    if (owned.length === 0) return undefined;
    const { months } = bucket(owned, "lastPlayed", "last_played");
    return {
      ...(Object.keys(months).length ? { months } : {}),
      made: [{ count: owned.length, label: "games" }],
    };
  },

  // --- YouTube -----------------------------------------------------------

  /**
   * The desktop version of this scope also returns the account's EMAIL ADDRESS.
   * Nothing in the score uses it and it is a direct identifier, so it is not
   * read here and there is a test that fails if it ever appears in the output.
   */
  "youtube.profile": (p) => {
    const joined = toDate(pick(p, "joinedDate", "joined_date"));
    const subscribers = toNumber(pick(p, "subscriberCount", "subscribers"));
    const videos = toNumber(pick(p, "videoCount", "videos"));
    if (!joined && subscribers === undefined && videos === undefined) return undefined;

    return {
      ...(joined
        ? { earliest: joined.toISOString(), earliestLabel: "YouTube account opened" }
        : {}),
      ...(subscribers !== undefined ? { followers: subscribers } : {}),
      ...(videos ? { made: [{ count: videos, label: "videos" }] } : {}),
    };
  },

  // --- Commerce ----------------------------------------------------------
  //
  // Four connectors, one shape: a list of orders with a date on each. Item
  // names, merchants, restaurants, totals and delivery addresses are all
  // dropped. A long, dull paper trail is exactly as useful to the score with
  // the contents removed, and far less dangerous to hold.

  "amazon.orders": (p) =>
    orders(p, "orders", ["orderDate", "date", "placedAt"], "Amazon orders", "first Amazon order"),

  "doordash.orders": (p) =>
    orders(p, "orders", ["date", "orderDate", "placedAt"], "DoorDash orders", "first DoorDash order"),

  "shop.orders": (p) =>
    orders(p, "orders", ["placedAt", "date", "orderDate"], "Shop orders", "first Shop order"),

  "uber.trips": (p) =>
    orders(p, "trips", ["requestTime", "requestedAt", "date"], "Uber trips", "first Uber trip"),
};

/** The shared shape behind Amazon, DoorDash, Shop and Uber. */
function orders(
  payload: unknown,
  key: string,
  dateKeys: string[],
  label: string,
  earliestLabel: string,
): Fragment | undefined {
  const items = Array.isArray(payload) ? payload : asArray(pick(payload, key));
  if (items.length === 0) return undefined;

  const { months, earliest } = bucket(items, ...dateKeys);
  return {
    ...(Object.keys(months).length ? { months } : {}),
    ...(earliest ? { earliest: earliest.toISOString(), earliestLabel } : {}),
    made: [{ count: toNumber(pick(payload, "total")) ?? items.length, label }],
  };
}

// ---------------------------------------------------------------------------
// Folding reads into a profile
// ---------------------------------------------------------------------------

function mergeMonths(a: Months | undefined, b: Months | undefined): Months | undefined {
  if (!a) return b;
  if (!b) return a;
  const merged: Months = { ...a };
  for (const [month, count] of Object.entries(b)) {
    merged[month] = (merged[month] ?? 0) + count;
  }
  return merged;
}

/**
 * Combine two reads of the same source.
 *
 * GitHub arrives as four separate scopes and Spotify as three, so this runs
 * several times per source. The rules that matter:
 *
 * - `earliest` keeps the OLDER date, and a hard date always beats a soft one
 *   even when the soft one is older. Somebody's typed LinkedIn history must not
 *   displace a real account-creation date as the thing we name on their page.
 * - `made` concatenates rather than sums, so the breakdown can still say
 *   "32 repos, 240 pull requests" instead of "272 things".
 */
function merge(existing: SourceEvidence | undefined, fragment: Fragment): SourceEvidence {
  if (!existing) return fragment as SourceEvidence;

  const next: SourceEvidence = { ...existing };

  if (fragment.earliest) {
    const incomingSoft = fragment.softDate === true;
    const currentSoft = existing.softDate === true;
    const older =
      !existing.earliest || new Date(fragment.earliest) < new Date(existing.earliest);

    // A hard date replaces a soft one regardless of age; a soft date only fills
    // a gap; otherwise the older of two like-for-like dates wins.
    const wins = currentSoft && !incomingSoft ? true : incomingSoft && !currentSoft ? false : older;

    if (wins) {
      next.earliest = fragment.earliest;
      next.earliestLabel = fragment.earliestLabel;
      next.softDate = incomingSoft;
    }
  }

  const months = mergeMonths(existing.months, fragment.months);
  if (months) next.months = months;

  const vouchMonths = mergeMonths(existing.vouchMonths, fragment.vouchMonths);
  if (vouchMonths) next.vouchMonths = vouchMonths;

  if (fragment.made?.length) {
    const seen = new Set((existing.made ?? []).map((kind) => kind.label));
    next.made = [...(existing.made ?? []), ...fragment.made.filter((k) => !seen.has(k.label))];
  }

  if (fragment.vouches) next.vouches = (existing.vouches ?? 0) + fragment.vouches;
  if (fragment.followers !== undefined) {
    next.followers = Math.max(existing.followers ?? 0, fragment.followers);
  }

  return next;
}

/**
 * Normalise ONE read. Pure: no merging, no memory of previous reads.
 *
 * Never throws. An unknown scope, an unrecognised envelope, or a payload with
 * nothing usable in it all return undefined, which the caller reports to the
 * user as an empty source they can go and fix.
 */
export function readScope(scope: string, raw: unknown): Fragment | undefined {
  if (!SCOPE_SOURCE[scope] || !NORMALIZERS[scope]) return undefined;

  try {
    const fragment = NORMALIZERS[scope](payloadFor(raw, scope));
    return fragment && Object.keys(fragment).length > 0 ? fragment : undefined;
  } catch (err) {
    // A shape we did not anticipate is a source that scores nothing, never a
    // broken page for somebody who connected successfully.
    console.error("[normalize] failed to read a payload", { scope, error: String(err) });
    return undefined;
  }
}

/**
 * Fold every stored fragment into the evidence the scorer reads.
 *
 * Deterministic: the same fragments always produce the same evidence, in the
 * manifest's order rather than in whatever order the user happened to connect
 * things. Two people with identical history score identically even if one of
 * them did Spotify first.
 */
export function evidenceFrom(fragments: Record<string, Fragment | undefined>): Evidence {
  const evidence: Evidence = {};

  // instagram.profile reports a post count that instagram.posts has already
  // counted individually. Prefer the dated version, or Depth counts them twice.
  const postsCounted = fragments["instagram.posts"]?.made?.some((k) => k.label === "posts");

  for (const scope of ALL_SCOPES) {
    let fragment = fragments[scope];
    if (!fragment) continue;

    if (scope === "instagram.profile" && postsCounted) {
      fragment = { ...fragment, made: undefined };
    }

    const source = SCOPE_SOURCE[scope];
    evidence[source] = merge(evidence[source], fragment);
  }

  return evidence;
}

/**
 * Convenience wrapper for a single read. Used by tests and anywhere only one
 * scope is in play; the live path stores fragments and calls `evidenceFrom`.
 */
export function foldRead(evidence: Evidence, scope: string, raw: unknown): Evidence {
  const fragment = readScope(scope, raw);
  if (!fragment) return evidence;

  const source = SCOPE_SOURCE[scope];
  const alreadyCountedPosts =
    scope === "instagram.profile" && evidence.instagram?.made?.some((k) => k.label === "posts");

  return {
    ...evidence,
    [source]: merge(evidence[source], alreadyCountedPosts ? { ...fragment, made: undefined } : fragment),
  };
}

/**
 * A stable identifier for the account behind a read, for detecting when two
 * people connect the same account.
 *
 * Returns a handle or id where the scope carries one, and never anything that
 * was not already public. Hashing happens in the store, not here.
 */
export function identityOf(scope: string, raw: unknown): string | undefined {
  const payload = payloadFor(raw, scope);
  const value = pick(
    payload,
    "username",
    "handle",
    "steamId",
    "id",
    "profileUrl",
    "channelUrl",
    "channelId",
  );
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
