/**
 * Turn the cold evidence into a story a person recognises as their own.
 *
 * The score answers "how much". This answers "what happened": the year it all
 * begins, the accounts opened one after another, the things made across a
 * decade, the people who gathered around them. It is built from exactly the
 * same data the score is, no account handles, nothing a public page would not
 * already show, arranged as a life rather than a number.
 *
 * WHAT v2 MADE POSSIBLE. v1 could only draw a real timeline for people who had
 * brought Instagram posts, because those were the only per-item timestamps the
 * web path could reach. Everything else was a single account-opened date and a
 * count. Desktop collection means every source arrives as a month histogram, so
 * the activity graph below is available to everybody and is built from all ten
 * sources at once.
 *
 * Pure and deterministic, so it can be tested without a browser and rendered on
 * the server. It never throws: a thin history yields a short story, not an error.
 */

import type { Evidence, Months, PatinaScore, SourceId } from "./score.ts";

export type TimelineEntry = {
  source: SourceId;
  /** Four-digit year the account or its first trace appears. */
  year: number;
  /** "Steam account opened", "earliest Instagram post". */
  label: string;
  /** True when the date is self-reported rather than machine-generated. */
  soft: boolean;
};

export type YearCount = { year: number; count: number };

export type Story = {
  /** The oldest provable year across everything, and how long ago that is. */
  startYear: number | null;
  spanYears: number | null;
  /** Plain-English origin, e.g. "your Steam account, opened in 2011". */
  origin: string | null;

  /** Every dated source, earliest first. The spine of the timeline. */
  timeline: TimelineEntry[];
  /** Sources that carry no date but were still connected. */
  alsoConnected: string[];

  /** Things made, kept per kind so they can be named. */
  made: Array<{ count: number; label: string }>;
  madeTotal: number;

  /**
   * Activity per year, gap-filled across the whole span.
   *
   * Gap-filled deliberately: the quiet years are part of the story and hiding
   * them would draw a graph of somebody who was always busy, which is both a
   * lie and less interesting than the truth.
   */
  activityByYear: YearCount[];
  /** The number of separate months with anything in them. */
  activeMonths: number;

  /** When other people showed up, by year. Empty when nothing dated came back. */
  vouchesByYear: YearCount[];
  vouchTotal: number;

  /** People following, across everything. The buyable number, shown small. */
  reach: number;

  /** The number the whole thing resolves to. */
  score: number;
  verdict: string;
  /** The component that carried the most weight, for the closing line. */
  strongest: { label: string; points: number; max: number } | null;
  /** Below the signing floor, so the page shows a number but no credential. */
  provisional: boolean;
};

/**
 * One source, reduced to what belongs on the face of its card.
 *
 * The connect page draws each connected source as an exhibit carrying its own
 * evidence, so it needs per-source facts rather than the merged totals the
 * score works from. Deliberately small: a date, a couple of counts, and how
 * complete the read was. Anything more and the card stops being scannable,
 * which is the only reason to draw it as a card.
 */
export type Exhibit = {
  source: SourceId;
  label: string;
  /** Four-digit year on the face of the card, or null when this source has no date. */
  year: number | null;
  /** "account opened", "first contribution". Sits under the year. */
  yearLabel: string | null;
  /** True when that date is self-reported rather than machine-generated. */
  soft: boolean;
  /** Distinct months this source alone can account for. */
  activeMonths: number;
  /** Things made, per kind, already filtered to the non-empty ones. */
  made: Array<{ count: number; label: string }>;
  /** Dated third-party connections this source contributed. */
  vouches: number;
};

/**
 * The two or three lines under the year, chosen per source.
 *
 * Every card would otherwise say the same thing in a different order. What is
 * worth reading differs: Steam's is its library, GitHub's is how many months it
 * covers, LinkedIn's is who showed up and when.
 */
export function exhibitFacts(exhibit: Exhibit): string[] {
  const facts: string[] = [];

  if (exhibit.vouches > 0) {
    facts.push(`${exhibit.vouches.toLocaleString()} dated connections`);
  }
  if (exhibit.activeMonths > 0) {
    facts.push(`${exhibit.activeMonths} active ${exhibit.activeMonths === 1 ? "month" : "months"}`);
  }
  for (const kind of exhibit.made) {
    if (facts.length >= 3) break;
    facts.push(`${kind.count.toLocaleString()} ${kind.label}`);
  }

  return facts.slice(0, 3);
}

/** Per-source display facts, for the exhibits on the connect board. */
export function buildExhibits(evidence: Evidence): Exhibit[] {
  return (Object.entries(evidence) as Array<[SourceId, Evidence[SourceId]]>)
    .filter((entry): entry is [SourceId, NonNullable<Evidence[SourceId]>] => Boolean(entry[1]))
    .map(([source, data]) => ({
      source,
      label: SOURCE_LABEL[source],
      year: yearOf(data.earliest),
      yearLabel: data.earliestLabel ? shortenLabel(data.earliestLabel, SOURCE_LABEL[source]) : null,
      soft: data.softDate === true,
      activeMonths: Object.keys(data.months ?? {}).length,
      made: (data.made ?? []).filter((kind) => kind && Number.isFinite(kind.count) && kind.count > 0),
      vouches: Object.values(data.vouchMonths ?? {}).reduce(
        (sum, count) => sum + (Number.isFinite(count) ? count : 0),
        0,
      ),
    }));
}

/**
 * "Steam account opened" becomes "account opened".
 *
 * The card already says Steam in the heading directly above, and repeating it
 * under the date is the kind of thing that reads as filler in a layout this
 * tight.
 */
function shortenLabel(label: string, sourceLabel: string): string {
  const trimmed = label.replace(new RegExp(`^${sourceLabel}\\s+`, "i"), "").trim();
  return trimmed || label;
}

const SOURCE_LABEL: Record<SourceId, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  spotify: "Spotify",
  instagram: "Instagram",
  steam: "Steam",
  youtube: "YouTube",
  amazon: "Amazon",
  uber: "Uber",
  doordash: "DoorDash",
  shop: "Shop",
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function yearOf(iso: string | undefined): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  return year >= 1990 && year <= new Date().getUTCFullYear() ? year : null;
}

/** Sum a set of month histograms into per-year totals. */
function byYear(histograms: Array<Months | undefined>): Map<number, number> {
  const years = new Map<number, number>();
  for (const histogram of histograms) {
    if (!histogram) continue;
    for (const [month, count] of Object.entries(histogram)) {
      const year = Number(month.slice(0, 4));
      if (!Number.isFinite(year) || typeof count !== "number" || !Number.isFinite(count)) continue;
      years.set(year, (years.get(year) ?? 0) + count);
    }
  }
  return years;
}

/** Every year from first to last, including the empty ones. */
function fill(years: Map<number, number>): YearCount[] {
  if (years.size === 0) return [];
  const keys = [...years.keys()].sort((a, b) => a - b);
  const out: YearCount[] = [];
  for (let year = keys[0]; year <= keys[keys.length - 1]; year += 1) {
    out.push({ year, count: years.get(year) ?? 0 });
  }
  return out;
}

function countMonths(histograms: Array<Months | undefined>): number {
  const months = new Set<string>();
  for (const histogram of histograms) {
    for (const month of Object.keys(histogram ?? {})) months.add(month);
  }
  return months.size;
}

export function buildStory(evidence: Evidence, score: PatinaScore): Story {
  const entries = (Object.entries(evidence) as Array<[SourceId, Evidence[SourceId]]>).filter(
    (entry): entry is [SourceId, NonNullable<Evidence[SourceId]>] => Boolean(entry[1]),
  );

  const timeline: TimelineEntry[] = [];
  const alsoConnected: string[] = [];

  for (const [source, data] of entries) {
    const year = yearOf(data.earliest);
    if (year === null) {
      alsoConnected.push(SOURCE_LABEL[source]);
      continue;
    }
    timeline.push({
      source,
      year,
      label: data.earliestLabel ?? `${SOURCE_LABEL[source]} account`,
      soft: data.softDate === true,
    });
  }

  timeline.sort((a, b) => a.year - b.year || SOURCE_LABEL[a.source].localeCompare(SOURCE_LABEL[b.source]));

  const made = entries.flatMap(([, data]) =>
    (data.made ?? []).filter((kind) => kind && Number.isFinite(kind.count) && kind.count > 0),
  );

  const activity = byYear(entries.map(([, data]) => data.months));
  const vouches = byYear(entries.map(([, data]) => data.vouchMonths));

  const strongest = [...score.components].sort(
    // By how much of its own maximum a component earned, not by raw points, or
    // Age would win almost every time simply for being the biggest row.
    (a, b) => b.points / b.max - a.points / a.max,
  )[0];

  const startYear = score.oldestSignal ? yearOf(score.oldestSignal.date) : (timeline[0]?.year ?? null);

  return {
    startYear,
    spanYears: score.oldestSignal
      ? Math.round(score.oldestSignal.years)
      : startYear
        ? new Date().getUTCFullYear() - startYear
        : null,
    origin: score.oldestSignal
      ? `your ${score.oldestSignal.source}, ${startYear ? `back in ${startYear}` : "the oldest thing you brought"}`
      : null,

    timeline,
    alsoConnected: alsoConnected.sort(),

    made,
    madeTotal: made.reduce((sum, kind) => sum + kind.count, 0),

    activityByYear: fill(activity),
    activeMonths: countMonths(entries.map(([, data]) => data.months)),

    vouchesByYear: fill(vouches),
    vouchTotal: [...vouches.values()].reduce((sum, count) => sum + count, 0),

    reach: entries.reduce(
      (sum, [, data]) => sum + (Number.isFinite(data.followers) ? (data.followers as number) : 0),
      0,
    ),

    score: score.total,
    verdict: verdictOf(score.total),
    strongest: strongest
      ? { label: strongest.label, points: strongest.points, max: strongest.max }
      : null,
    provisional: score.provisional,
  };
}

/** Kept local so story.ts stays pure and importable from a client component. */
function verdictOf(total: number): string {
  if (total >= 80) return "Deeply worn in";
  if (total >= 60) return "Well established";
  if (total >= 40) return "Some real history";
  if (total >= 20) return "Thin, but genuine so far";
  return "Not much to go on yet";
}

/**
 * The one-sentence version, for a share card or a meta description.
 *
 * Written to be true of a thin history as well as a deep one. A person with two
 * years and one account should get a sentence they would be happy to post,
 * because a low score is evidence of absence rather than an accusation and the
 * copy has to carry that or the product reads as a judgement.
 */
export function storyLine(story: Story): string {
  if (story.startYear === null) {
    return "Nothing connected yet.";
  }

  const span =
    story.spanYears && story.spanYears >= 1
      ? `${story.spanYears} ${story.spanYears === 1 ? "year" : "years"} of provable history`
      : "a history that is just getting started";

  const sources = story.timeline.length + story.alsoConnected.length;
  const backing =
    sources > 1 ? `, across ${sources} accounts that agree with each other` : ", from one account";

  return `${span}${backing}. Patina ${story.score}.`;
}

export { SOURCE_LABEL };
