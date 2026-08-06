/**
 * Turn the cold evidence into a story a person recognises as their own.
 *
 * The score answers "how much". This answers "what happened": the year it all
 * begins, the accounts opened one after another, the things made across a
 * decade, the people who gathered around them. It is the same data the card is
 * built from, no account handles, nothing the card would not already show, 
 * arranged as a life rather than a number.
 *
 * Pure and deterministic, so it can be tested without a browser and rendered on
 * the server. It never throws: a thin history yields a short story, not an error.
 */

import type { Evidence, PatinaScore, SourceId } from "./score";

export type TimelineEntry = {
  source: SourceId;
  /** Four-digit year the account or first trace appears. */
  year: number;
  /** "opened YouTube", "joined GitHub", "first Instagram post". */
  label: string;
};

export type Story = {
  /** The oldest provable year across everything, and how long ago that is. */
  startYear: number | null;
  spanYears: number | null;
  /** Plain-English origin, e.g. "your YouTube account, opened in 2012". */
  origin: string | null;

  /** Every dated source, earliest first. The spine of the timeline. */
  timeline: TimelineEntry[];
  /** Sources that carry no date but were still connected. */
  alsoConnected: string[];

  /** Things made, that a person can point at. */
  made: { posts: number; videos: number; repos: number; total: number };
  /** Per-year post counts, gap-filled, when Instagram posts were brought. */
  postsByYear: { year: number; count: number }[] | null;

  /** People and organisations gathered around them. */
  reach: number;
  vouches: number;

  /** The number the whole thing resolves to. */
  score: number;
  verdict: string;
  /** The component that carried the most weight, for the closing line. */
  strongest: { label: string; points: number; max: number } | null;
};

const SOURCE_LABEL: Record<SourceId, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  github: "GitHub",
  spotify: "Spotify",
  linkedin: "LinkedIn",
  amazon: "Amazon",
  uber: "Uber",
  steam: "Steam",
};

function yearOf(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  const year = new Date(time).getUTCFullYear();
  // Guard against obviously broken dates that would make the story lie.
  return year >= 1990 && year <= new Date().getUTCFullYear() ? year : null;
}

export function buildStory(evidence: Evidence, score: PatinaScore, verdict: string): Story {
  const timeline: TimelineEntry[] = [];

  const ytYear = yearOf(evidence.youtube?.joinedDate);
  if (ytYear) timeline.push({ source: "youtube", year: ytYear, label: "opened YouTube" });

  const ghYear = yearOf(evidence.github?.createdAt);
  if (ghYear) timeline.push({ source: "github", year: ghYear, label: "joined GitHub" });

  const liYear = yearOf(evidence.linkedin?.createdAt);
  if (liYear) timeline.push({ source: "linkedin", year: liYear, label: "joined LinkedIn" });

  const postYears = (evidence.instagramPosts?.posts ?? [])
    .map((post) => yearOf(post.taken_at))
    .filter((y): y is number => y !== null)
    .sort((a, b) => a - b);
  if (postYears[0]) {
    timeline.push({ source: "instagram", year: postYears[0], label: "first Instagram post" });
  }

  const steamYear = yearOf(evidence.steam?.accountCreated);
  if (steamYear) timeline.push({ source: "steam", year: steamYear, label: "created Steam" });

  const amazonYear = yearOf(evidence.amazon?.earliestOrder);
  if (amazonYear) timeline.push({ source: "amazon", year: amazonYear, label: "first Amazon order" });

  const uberYear = yearOf(evidence.uber?.earliestTrip);
  if (uberYear) timeline.push({ source: "uber", year: uberYear, label: "first Uber trip" });

  timeline.sort((a, b) => a.year - b.year);

  // Sources present but undated, so they still get a mention rather than
  // vanishing from a story that is meant to account for everything connected.
  const dated = new Set(timeline.map((entry) => entry.source));
  const alsoConnected = score.sourcesConnected
    .filter((source) => !dated.has(source))
    .map((source) => SOURCE_LABEL[source]);

  const startYear = score.oldestSignal
    ? new Date(score.oldestSignal.date).getUTCFullYear()
    : (timeline[0]?.year ?? null);
  const spanYears = score.oldestSignal ? Math.floor(score.oldestSignal.years) : null;
  const origin = timeline[0]
    ? `your ${SOURCE_LABEL[timeline[0].source]} account, from ${timeline[0].year}`
    : null;

  const posts =
    evidence.instagram?.media_count ?? evidence.instagramPosts?.posts?.length ?? 0;
  const videos = evidence.youtube?.videoCount ?? 0;
  const repos = evidence.github?.repositoryCount ?? 0;

  const reach =
    (evidence.instagram?.follower_count ?? 0) +
    (evidence.youtube?.subscriberCount ?? 0) +
    (evidence.github?.followers ?? 0) +
    (evidence.spotify?.followers ?? 0) +
    (evidence.linkedin?.connections ?? 0);

  const vouches =
    (evidence.github?.organizations?.length ?? 0) +
    (evidence.github?.achievements?.length ?? 0);

  const strongest = [...score.components]
    .filter((component) => component.points > 0)
    .sort((a, b) => b.points - a.points)[0];

  return {
    startYear,
    spanYears,
    origin,
    timeline,
    alsoConnected,
    made: { posts, videos, repos, total: posts + videos + repos },
    postsByYear: postYears.length >= 2 ? countByYear(postYears) : null,
    reach,
    vouches,
    score: score.total,
    verdict,
    strongest: strongest
      ? { label: strongest.label, points: strongest.points, max: strongest.max }
      : null,
  };
}

/** Group years into a gap-filled run, so a quiet year reads as a real gap. */
function countByYear(years: number[]): { year: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const year of years) counts.set(year, (counts.get(year) ?? 0) + 1);

  const first = years[0];
  const last = years[years.length - 1];
  const out: { year: number; count: number }[] = [];
  for (let year = first; year <= last; year += 1) {
    out.push({ year, count: counts.get(year) ?? 0 });
  }
  return out;
}
