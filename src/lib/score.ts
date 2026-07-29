/**
 * The Patina score.
 *
 * The claim this file has to defend: a person cannot fake a decade of ordinary
 * digital life. Wallets are free and instant. A YouTube account opened in 2013,
 * with posts scattered across forty different months, is not.
 *
 * Every component below is chosen because it is EXPENSIVE IN TIME rather than
 * expensive in money. Follower counts can be bought; the gap between your first
 * post and your last cannot. Where a signal is buyable we weight it low and say
 * so in the comment.
 *
 * Nothing here is secret. The breakdown is returned in full and shown to the
 * user, because a score nobody can interrogate is a score nobody should trust.
 */

export type SourceId = "youtube" | "instagram" | "github" | "spotify" | "linkedin";

export type YouTubeProfile = {
  joinedDate?: string | null;
  subscriberCount?: number | null;
  viewCount?: number | null;
  videoCount?: number | null;
  handle?: string | null;
  channelTitle?: string | null;
};

export type InstagramProfile = {
  username?: string;
  follower_count?: number;
  following_count?: number;
  media_count?: number;
  is_private?: boolean;
  is_verified?: boolean;
  is_business?: boolean;
};

export type InstagramPosts = {
  posts?: Array<{ taken_at?: string; num_of_likes?: number; caption?: string }>;
};

export type GitHubProfile = {
  username?: string;
  followers?: number;
  repositoryCount?: number;
  contributionsLastYear?: number | null;
  /**
   * Account creation date. Absent from the published desktop schema, but
   * server-side collection returns it, and it is the single best age signal
   * GitHub gives us. See normalize.ts.
   */
  createdAt?: string;
  totalStars?: number;
  organizations?: Array<{ login: string }>;
  achievements?: Array<{ name: string }>;
  pinnedRepositories?: Array<{ stars?: number }>;
};

export type SpotifyProfile = {
  id?: string;
  display_name?: string;
  followers?: number;
};

/**
 * LinkedIn's published web schema has no account-opened date — only profile
 * text and a connections count. So on the web path it feeds Standing and
 * Breadth, not Age. Defensively keep a createdAt slot in case Data Pipe ever
 * returns one the way GitHub does.
 */
export type LinkedInProfile = {
  profileUrl?: string;
  fullName?: string;
  headline?: string;
  location?: string;
  /** Parsed from strings like "500+" that the connector often returns. */
  connections?: number;
  about?: string;
  createdAt?: string;
};

export type Evidence = {
  youtube?: YouTubeProfile;
  instagram?: InstagramProfile;
  instagramPosts?: InstagramPosts;
  github?: GitHubProfile;
  spotify?: SpotifyProfile;
  linkedin?: LinkedInProfile;
};

export type Component = {
  key: "age" | "corroboration" | "depth" | "standing" | "breadth";
  label: string;
  /** Points awarded, already capped at `max`. */
  points: number;
  max: number;
  /** Plain-English sentence shown under the number. No jargon. */
  detail: string;
};

export type PatinaScore = {
  total: number;
  components: Component[];
  /** Oldest date we can prove, across every connected source. */
  oldestSignal: { date: string; years: number; source: string } | null;
  sourcesConnected: SourceId[];
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Diminishing returns. Reaches `max` asymptotically; `half` is the value worth half of max. */
function saturate(value: number, half: number, max: number): number {
  if (value <= 0) return 0;
  return (max * value) / (value + half);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * AGE (max 40). The load-bearing component.
 *
 * The single oldest thing provable across every connected source: the day a
 * YouTube account was opened, the day a GitHub account was created, or the
 * earliest Instagram post if a desktop user brought their post history. Twelve
 * years scores full.
 */
function ageComponent(evidence: Evidence): { component: Component; oldest: PatinaScore["oldestSignal"] } {
  const candidates: Array<{ date: Date; source: string }> = [];

  const joined = parseDate(evidence.youtube?.joinedDate);
  if (joined) candidates.push({ date: joined, source: "YouTube account opened" });

  const ghCreated = parseDate(evidence.github?.createdAt);
  if (ghCreated) candidates.push({ date: ghCreated, source: "GitHub account opened" });

  const liCreated = parseDate(evidence.linkedin?.createdAt);
  if (liCreated) candidates.push({ date: liCreated, source: "LinkedIn account opened" });

  const postDates = (evidence.instagramPosts?.posts ?? [])
    .map((post) => parseDate(post.taken_at))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  if (postDates[0]) candidates.push({ date: postDates[0], source: "earliest Instagram post" });

  if (candidates.length === 0) {
    return {
      component: {
        key: "age",
        label: "Age",
        points: 0,
        max: 40,
        detail: "Nothing connected yet that carries a date.",
      },
      oldest: null,
    };
  }

  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const winner = candidates[0];
  const years = (Date.now() - winner.date.getTime()) / MS_PER_YEAR;
  const points = Math.min(40, (Math.max(0, years) / 12) * 40);

  return {
    component: {
      key: "age",
      label: "Age",
      points: round(points),
      max: 40,
      detail: `${years.toFixed(1)} years back, from your ${winner.source}.`,
    },
    oldest: {
      date: winner.date.toISOString(),
      years: round(years),
      source: winner.source,
    },
  };
}

/**
 * CORROBORATION (max 20).
 *
 * How many sources INDEPENDENTLY prove a date. One old account could be bought;
 * two unrelated platforms both saying you have been around since 2012 is a much
 * more expensive thing to arrange, because the attacker has to buy an aged
 * account on each.
 *
 * This replaced a "continuity" component that counted distinct months of
 * Instagram post timestamps. That was the better measure and it is unreachable:
 * per-item timestamps only exist on scopes the DESKTOP app collects, so on the
 * web it scored zero for everybody and made a quarter of the total unwinnable.
 * A score with points nobody can earn is not a strict score, it is a broken one.
 */
function corroborationComponent(evidence: Evidence): Component {
  const yearsSince = (date: Date | null) =>
    date === null ? null : Math.max(0, (Date.now() - date.getTime()) / MS_PER_YEAR);

  const oldestPost = (evidence.instagramPosts?.posts ?? [])
    .map((post) => parseDate(post.taken_at))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const dated = (
    [
      ["YouTube", yearsSince(parseDate(evidence.youtube?.joinedDate))],
      ["GitHub", yearsSince(parseDate(evidence.github?.createdAt))],
      ["LinkedIn", yearsSince(parseDate(evidence.linkedin?.createdAt ?? null))],
      ["Instagram", yearsSince(oldestPost ?? null)],
    ] as [string, number | null][]
  ).filter((entry): entry is [string, number] => entry[1] !== null);

  /**
   * Each source counts for how OLD it is, not merely for existing.
   *
   * Counting sources rather than their age was worth 16 points to an account
   * farm whose every account was a fortnight old: three fresh profiles all
   * "agreeing" they started last Tuesday corroborate nothing. Eight years is
   * treated as a full vote, so a decade-old account carries one and a week-old
   * one carries almost none.
   */
  const weight = dated.reduce((sum, [, years]) => sum + Math.min(years / 8, 1), 0);
  const points = Math.min(20, weight * 10);

  const named = dated.map(([name]) => name);
  const detail =
    named.length === 0
      ? "Connect YouTube or GitHub: both carry the date the account was opened."
      : points < 4
        ? "These accounts are too new to back each other up yet."
        : named.length === 1
          ? `${named[0]} proves when you started. A second source proving it separately is worth a lot more.`
          : `${named.join(" and ")} independently agree on how far back you go.`;

  return { key: "corroboration", label: "Corroboration", points: round(points), max: 20, detail };
}

/**
 * DEPTH (max 20). Volume of things you actually made.
 *
 * Posts, videos, repositories. Buyable in principle, tedious in practice, so it
 * earns real but limited weight.
 */
function depthComponent(evidence: Evidence, connected: number): Component {
  // media_count on the web path; a desktop user who brought their actual posts
  // gets counted from those instead.
  const instagramPosts =
    evidence.instagram?.media_count ?? evidence.instagramPosts?.posts?.length ?? 0;

  const made =
    instagramPosts +
    (evidence.youtube?.videoCount ?? 0) +
    (evidence.github?.repositoryCount ?? 0);

  const parts: string[] = [];
  if (instagramPosts) parts.push(`${instagramPosts} posts`);
  if (evidence.youtube?.videoCount) parts.push(`${evidence.youtube.videoCount} videos`);
  if (evidence.github?.repositoryCount) parts.push(`${evidence.github.repositoryCount} repos`);

  const detail = parts.length
    ? parts.join(", ") + "."
    : connected === 0
      ? "Counts the posts, videos and repositories you have made."
      : "Nothing made yet on the sources you connected.";

  return {
    key: "depth",
    label: "Depth",
    points: round(saturate(made, 60, 20)),
    max: 20,
    detail,
  };
}

/**
 * STANDING (max 10). Other people and organisations treating you as real.
 *
 * Weighted LOW on purpose. Followers are the most purchasable signal on this
 * list, so it contributes flavour rather than substance. GitHub organisations
 * and achievements count more per unit than raw follower counts, because
 * somebody else had to let you in.
 */
function standingComponent(evidence: Evidence, connected: number): Component {
  const followers =
    (evidence.instagram?.follower_count ?? 0) +
    (evidence.youtube?.subscriberCount ?? 0) +
    (evidence.github?.followers ?? 0) +
    (evidence.spotify?.followers ?? 0) +
    (evidence.linkedin?.connections ?? 0);

  const vouches =
    (evidence.github?.organizations?.length ?? 0) + (evidence.github?.achievements?.length ?? 0);

  const points = Math.min(10, saturate(followers, 900, 6) + saturate(vouches, 3, 4));

  const detail =
    connected === 0
      ? "Other people and organisations treating you as real."
      : vouches
        ? `${followers.toLocaleString()} following you, and ${vouches} org or badge ${vouches === 1 ? "credit" : "credits"}.`
        : `${followers.toLocaleString()} people following you across your accounts.`;

  return { key: "standing", label: "Standing", points: round(points), max: 10, detail };
}

/**
 * BREADTH (max 10). Independent corroboration.
 *
 * Faking one account is easy. Faking four, each with its own years of history,
 * is a different job entirely. Scored steeply for the second and third source
 * because that is where the cost to an attacker rises fastest.
 */
function breadthComponent(sources: SourceId[]): Component {
  // Caps at 10 once four sources are connected; a fifth (LinkedIn) corroborates
  // but does not invent points past the ceiling.
  const table = [0, 3, 6, 8, 10, 10];
  const points = table[Math.min(sources.length, 5)];

  const detail =
    sources.length === 0
      ? "Independent accounts that back each other up."
      : sources.length === 1
        ? "One source. Add another and this climbs fast."
        : `${sources.length} independent accounts telling the same story.`;

  return { key: "breadth", label: "Breadth", points, max: 10, detail };
}

/**
 * Everything except age and corroboration is gated behind this.
 *
 * An account farm can manufacture breadth, depth and followers in an afternoon:
 * open four accounts, bulk-upload, buy 3,000 followers. What it cannot
 * manufacture is the time underneath them. So volume, standing and breadth only
 * count to the extent that real elapsed history backs them up.
 *
 * The 0.15 floor is deliberate. A nineteen-year-old with a genuine three-year
 * account is not a fraud, and should not be flattened to zero for being young.
 */
function timeFactor(age: Component, corroboration: Component): number {
  const raw = 0.6 * (age.points / age.max) + 0.4 * (corroboration.points / corroboration.max);
  return 0.15 + 0.85 * Math.min(1, raw);
}

export function scorePatina(evidence: Evidence): PatinaScore {
  const sourcesConnected: SourceId[] = [];
  if (evidence.youtube) sourcesConnected.push("youtube");
  if (evidence.instagram || evidence.instagramPosts) sourcesConnected.push("instagram");
  if (evidence.github) sourcesConnected.push("github");
  if (evidence.spotify) sourcesConnected.push("spotify");
  if (evidence.linkedin) sourcesConnected.push("linkedin");

  const { component: age, oldest } = ageComponent(evidence);
  const corroboration = corroborationComponent(evidence);
  const factor = timeFactor(age, corroboration);

  // Time is earned outright. Everything else is only worth what time backs.
  // The gating note is suppressed before anything is connected, where it would
  // just be noise attached to a row of zeroes.
  const gated = [
    depthComponent(evidence, sourcesConnected.length),
    standingComponent(evidence, sourcesConnected.length),
    breadthComponent(sourcesConnected),
  ].map((component) => ({
    ...component,
    points: round(component.points * factor),
    detail:
      factor < 0.5 && sourcesConnected.length > 0
        ? `${component.detail} Counted at ${Math.round(factor * 100)}% until there is more history behind it.`
        : component.detail,
  }));

  const components = [age, corroboration, ...gated];
  const total = Math.round(components.reduce((sum, c) => sum + c.points, 0));

  return { total, components, oldestSignal: oldest, sourcesConnected };
}

/**
 * The one-line verdict. Deliberately conservative wording: Patina reports how
 * much history it can SEE, and never claims to have proved a human. An empty
 * score means "no evidence", not "fraud".
 */
export function verdict(score: PatinaScore): string {
  if (score.total >= 80) return "Deeply worn in";
  if (score.total >= 60) return "Well established";
  if (score.total >= 40) return "Some real history";
  if (score.total >= 20) return "Thin, but genuine so far";
  return "Not much to go on yet";
}
