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

export type SourceId = "youtube" | "instagram" | "github" | "spotify";

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

export type Evidence = {
  youtube?: YouTubeProfile;
  instagram?: InstagramProfile;
  instagramPosts?: InstagramPosts;
  github?: GitHubProfile;
  spotify?: SpotifyProfile;
};

export type Component = {
  key: "age" | "continuity" | "depth" | "standing" | "breadth";
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
 * AGE (max 34). The load-bearing component.
 *
 * We take the single oldest thing we can prove across all sources: the day the
 * YouTube account was opened, or the timestamp on the earliest Instagram post
 * we can see. Twelve years is treated as a full score, which is roughly the age
 * of an account opened by an adult who was online before it was compulsory.
 */
function ageComponent(evidence: Evidence): { component: Component; oldest: PatinaScore["oldestSignal"] } {
  const candidates: Array<{ date: Date; source: string }> = [];

  const joined = parseDate(evidence.youtube?.joinedDate);
  if (joined) candidates.push({ date: joined, source: "YouTube account opened" });

  const ghCreated = parseDate(evidence.github?.createdAt);
  if (ghCreated) candidates.push({ date: ghCreated, source: "GitHub account opened" });

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
        max: 34,
        detail: "Nothing connected yet that carries a date.",
      },
      oldest: null,
    };
  }

  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const winner = candidates[0];
  const years = (Date.now() - winner.date.getTime()) / MS_PER_YEAR;
  const points = Math.min(34, (Math.max(0, years) / 12) * 34);

  return {
    component: {
      key: "age",
      label: "Age",
      points: round(points),
      max: 34,
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
 * CONTINUITY (max 26). The component farmers cannot cheat cheaply.
 *
 * A real life leaves marks in a lot of separate months. A farmed account is
 * built in an afternoon, so all its activity lands in one or two. We count how
 * many DISTINCT MONTHS the Instagram posts touch, which is the only source here
 * that gives us per-item timestamps.
 *
 * Deliberately not "number of posts": a thousand posts made on one Tuesday
 * should score near zero, and under this rule it does.
 */
function continuityComponent(evidence: Evidence): Component {
  const dates = (evidence.instagramPosts?.posts ?? [])
    .map((post) => parseDate(post.taken_at))
    .filter((d): d is Date => d !== null);

  if (dates.length === 0) {
    return {
      key: "continuity",
      label: "Continuity",
      points: 0,
      max: 26,
      detail: "Connect Instagram to show your history is spread over real time.",
    };
  }

  const months = new Set(dates.map((d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`));
  const points = saturate(months.size, 18, 26);

  return {
    key: "continuity",
    label: "Continuity",
    points: round(points),
    max: 26,
    detail: `Activity in ${months.size} separate ${months.size === 1 ? "month" : "months"}, not one burst.`,
  };
}

/**
 * DEPTH (max 18). Volume of things you actually made.
 *
 * Posts, videos, repositories. Buyable in principle, tedious in practice, so it
 * earns real but limited weight.
 */
function depthComponent(evidence: Evidence, connected: number): Component {
  const made =
    (evidence.instagram?.media_count ?? 0) +
    (evidence.youtube?.videoCount ?? 0) +
    (evidence.github?.repositoryCount ?? 0);

  const parts: string[] = [];
  if (evidence.instagram?.media_count) parts.push(`${evidence.instagram.media_count} posts`);
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
    points: round(saturate(made, 60, 18)),
    max: 18,
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
    (evidence.spotify?.followers ?? 0);

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
 * BREADTH (max 12). Independent corroboration.
 *
 * Faking one account is easy. Faking four, each with its own years of history,
 * is a different job entirely. Scored steeply for the second and third source
 * because that is where the cost to an attacker rises fastest.
 */
function breadthComponent(sources: SourceId[]): Component {
  const table = [0, 3, 7, 10, 12];
  const points = table[Math.min(sources.length, 4)];

  const detail =
    sources.length === 0
      ? "Independent accounts that back each other up."
      : sources.length === 1
        ? "One source. Add another and this climbs fast."
        : `${sources.length} independent accounts telling the same story.`;

  return { key: "breadth", label: "Breadth", points, max: 12, detail };
}

/**
 * Everything except age and continuity is gated behind this.
 *
 * An account farm can manufacture breadth, depth and followers in an afternoon:
 * open four accounts, bulk-upload, buy 3,000 followers. What it cannot
 * manufacture is the time underneath them. So volume, standing and breadth only
 * count to the extent that real elapsed history backs them up.
 *
 * The 0.15 floor is deliberate. A nineteen-year-old with a genuine three-year
 * account is not a fraud, and should not be flattened to zero for being young.
 */
function timeFactor(age: Component, continuity: Component): number {
  const raw = 0.6 * (age.points / age.max) + 0.4 * (continuity.points / continuity.max);
  return 0.15 + 0.85 * Math.min(1, raw);
}

export function scorePatina(evidence: Evidence): PatinaScore {
  const sourcesConnected: SourceId[] = [];
  if (evidence.youtube) sourcesConnected.push("youtube");
  if (evidence.instagram || evidence.instagramPosts) sourcesConnected.push("instagram");
  if (evidence.github) sourcesConnected.push("github");
  if (evidence.spotify) sourcesConnected.push("spotify");

  const { component: age, oldest } = ageComponent(evidence);
  const continuity = continuityComponent(evidence);
  const factor = timeFactor(age, continuity);

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

  const components = [age, continuity, ...gated];
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
