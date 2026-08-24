/**
 * The Patina score, v2.
 *
 * The claim this file has to defend: a person cannot fake a decade of ordinary
 * digital life. Wallets are free and instant. A GitHub account with pull
 * requests scattered across ninety different months, and forty people who chose
 * to connect to it in forty different years-ago, is not.
 *
 * WHAT CHANGED FROM v1, AND WHY.
 *
 * v1 scored Age 40, Corroboration 20, Depth 20, Standing 10, Breadth 10. Those
 * weights were shaped by a constraint that no longer exists. Continuity (how
 * many distinct months you were actually present for) was the best signal we
 * had and it was unreachable: per-item timestamps only existed on scopes the
 * desktop app collects, so on the web path it scored zero for everybody. It was
 * cut, and Depth inherited weight it did not deserve.
 *
 * v2 is desktop-only. Every source arrives through Vana Desktop, which means
 * per-item timestamps everywhere. So Continuity comes back at 25, Depth halves
 * to the 10 it was always worth, and Standing (raw follower counts) stops being
 * a row at all: it survives as a heavily discounted term inside Vouches,
 * because a timestamped connection from a real person is a strictly better
 * version of the same claim.
 *
 * Age also comes DOWN, from 40 to 30, which is counter-intuitive for a product
 * about age. The reason is what desktop actually proves. Signing in on your own
 * machine proves session CONTROL, not ownership, and a bought aged account
 * arrives with its password. So a single old date is the most transferable
 * signal on this list. What is much harder to transfer is a decade of other
 * people showing up: connections made, friendships formed, reactions left. That
 * is why weight moved onto Continuity and Vouches.
 *
 * Nothing here is secret. The breakdown is returned in full and shown to the
 * user, because a score nobody can interrogate is a score nobody should trust.
 */

export type SourceId =
  | "github"
  | "linkedin"
  | "spotify"
  | "instagram"
  | "steam"
  | "youtube"
  | "amazon"
  | "uber"
  | "doordash"
  | "shop";

export const SOURCE_IDS: SourceId[] = [
  "github",
  "linkedin",
  "spotify",
  "instagram",
  "steam",
  "youtube",
  "amazon",
  "uber",
  "doordash",
  "shop",
];

/**
 * A month histogram: "YYYY-MM" to the number of items in that month.
 *
 * Every timestamped scope collapses into one of these at normalize time,
 * BEFORE anything is persisted. Two reasons, and the second is the important
 * one.
 *
 * Storage: somebody with 5,000 saved Spotify tracks would otherwise mean 5,000
 * ISO strings sitting in Redis to answer a question about months.
 *
 * Privacy: a month bucket reveals strictly less than an exact timestamp. "You
 * saved 12 tracks in March 2019" cannot be cross-referenced against anything.
 * "You saved this track at 02:14:33 on 3 March 2019" can. Since the scorer only
 * ever asks about months, holding anything finer would be holding it for no
 * reason, which is the definition of what we promised not to do.
 */
export type Months = Record<string, number>;

/**
 * What we keep from any one source, after normalize has thrown away the rest.
 *
 * Deliberately uniform across all ten sources. The scorer does not know or care
 * whether a month bucket came from Spotify saves or Amazon orders: a timestamp
 * is a timestamp, and treating them identically is what stops the weights from
 * quietly encoding an opinion about which platform is more respectable.
 */
export type SourceEvidence = {
  /** Oldest date provable for this source, ISO. Feeds Age and Corroboration. */
  earliest?: string;
  /** Plain-English name for that date, e.g. "Steam account opened". */
  earliestLabel?: string;
  /**
   * True when `earliest` came from self-reported free text rather than a
   * machine-generated timestamp. Only LinkedIn experience and education set
   * this. See ageComponent for what it costs them.
   */
  softDate?: boolean;
  /** Month histogram of things the person made or did. Feeds Continuity, Depth, Cadence. */
  months?: Months;
  /**
   * Things the person made on this source, kept PER KIND rather than summed.
   *
   * One source now arrives as several scopes: GitHub sends repositories and
   * pull requests separately, Spotify sends saved tracks and playlists. Summing
   * them on arrival would let the breakdown say "272 things" where it could say
   * "32 repos, 240 pull requests", and a score whose breakdown is vaguer than
   * the evidence behind it is a score people are right to distrust.
   */
  made?: Array<{ count: number; label: string }>;
  /**
   * Month histogram of TIMESTAMPED third-party actions: LinkedIn connections by
   * dateConnected, Steam friends by friendSince. Feeds Vouches.
   */
  vouchMonths?: Months;
  /**
   * Third-party credits with no usable timestamp: GitHub organisation
   * memberships, achievement badges, reactions received. Worth less than a
   * dated vouch because we cannot tell a decade-old one from last Tuesday's.
   */
  vouches?: number;
  /** People following or connected. The most buyable number here, weighted accordingly. */
  followers?: number;
};

export type Evidence = Partial<Record<SourceId, SourceEvidence>>;

export type ComponentKey =
  | "age"
  | "continuity"
  | "corroboration"
  | "vouches"
  | "depth"
  | "breadth";

export type Component = {
  key: ComponentKey;
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
  /**
   * Whether this score is complete enough to sign.
   *
   * Below the floor Patina still shows the number, but issues no badge, no
   * signed attestation and no public page. The customer for a credential is the
   * verifier, and a verifier consuming a one-source score gets noise. Every
   * noisy credential spent devalues the rest, so refusing to SIGN is how the
   * number keeps meaning something. Refusing to SHOW it would just be rude to
   * the person who did the work.
   */
  provisional: boolean;
  /** Why it is provisional, or null when it is not. */
  provisionalReason: string | null;
};

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Full marks at twelve years. */
const AGE_FULL_YEARS = 12;
/** Full marks at eight years of distinct active months. */
const CONTINUITY_FULL_MONTHS = 96;
/** A source counts as a full corroborating vote at eight years old. */
const CORROBORATION_FULL_YEARS = 8;
/** A vouch counts fully once it is five years old. */
const VOUCH_FULL_YEARS = 5;

/** Below this many sources, or dated sources, the score will not be signed. */
const FLOOR_SOURCES = 3;
const FLOOR_DATED_SOURCES = 2;

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Every number that reaches the arithmetic goes through here first.
 *
 * Vana's payload shapes have changed under us before, and a single `NaN` or a
 * string where a count was expected propagates through every sum and comes out
 * as a total of `NaN` on somebody's profile page. An unreadable field is absent
 * evidence, which scores zero. It is never a crash.
 */
function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function yearsSince(date: Date): number {
  return Math.max(0, (Date.now() - date.getTime()) / MS_PER_YEAR);
}

/** Diminishing returns. Reaches `max` asymptotically; `half` is the value worth half of max. */
function saturate(value: number, half: number, max: number): number {
  if (value <= 0) return 0;
  return (max * value) / (value + half);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function entries(evidence: Evidence): Array<[SourceId, SourceEvidence]> {
  return SOURCE_IDS.filter((id) => evidence[id] !== undefined).map((id) => [
    id,
    evidence[id] as SourceEvidence,
  ]);
}

/** Merge every source's month histogram into one. */
function mergeMonths(histograms: Array<Months | undefined>): Months {
  const merged: Months = {};
  for (const histogram of histograms) {
    if (!histogram) continue;
    for (const [month, count] of Object.entries(histogram)) {
      if (!/^\d{4}-\d{2}$/.test(month)) continue;
      const n = num(count);
      if (n <= 0) continue;
      merged[month] = (merged[month] ?? 0) + n;
    }
  }
  return merged;
}

/** Whole months between an ISO month key and now. */
function monthsSinceKey(month: string): number {
  const [year, m] = month.split("-").map(Number);
  const now = new Date();
  return (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - m);
}

/**
 * AGE (max 30). The oldest date provable across every connected source.
 *
 * Down from v1's 40. A single old date is the one thing an attacker can buy
 * outright, because credentials transfer. It is still the largest component,
 * because it is still the thing nobody can manufacture from nothing, but it no
 * longer carries nearly half the score on its own.
 */
function ageComponent(evidence: Evidence): {
  component: Component;
  oldest: PatinaScore["oldestSignal"];
} {
  const dated = entries(evidence)
    .map(([, source]) => ({
      date: parseDate(source.earliest),
      label: source.earliestLabel ?? "an account you connected",
      soft: source.softDate === true,
    }))
    .filter((c): c is { date: Date; label: string; soft: boolean } => c.date !== null);

  const hard = dated.filter((c) => !c.soft).sort((a, b) => a.date.getTime() - b.date.getTime());
  const soft = dated.filter((c) => c.soft).sort((a, b) => a.date.getTime() - b.date.getTime());

  if (hard.length === 0) {
    // Soft dates alone prove nothing. LinkedIn experience is free text somebody
    // typed about themselves, and a score that let a typed "1998" outrank a real
    // 2009 account would be worthless the day anyone noticed.
    const detail =
      soft.length > 0
        ? "Your LinkedIn history needs a dated account alongside it before it counts."
        : "Nothing connected yet that carries a date.";
    return {
      component: { key: "age", label: "Age", points: 0, max: 30, detail },
      oldest: null,
    };
  }

  const winner = hard[0];
  let years = yearsSince(winner.date);

  /**
   * Self-reported history extends Age at HALF weight, and only on top of a real
   * date. Somebody whose LinkedIn says they started work in 2005 and whose
   * oldest hard account is 2013 gets credit for part of that gap, not all of it,
   * because we cannot check it and they know we cannot check it.
   */
  const hardYears = years;
  let extendedBy: string | null = null;
  if (soft.length > 0) {
    const softYears = yearsSince(soft[0].date);
    if (softYears > years) {
      years += (softYears - years) * 0.5;
      extendedBy = soft[0].label;
    }
  }

  const points = Math.min(30, (years / AGE_FULL_YEARS) * 30);

  // Never report a number the named source cannot account for. Saying "12.0
  // years, from your GitHub account" when that account is eleven years old reads
  // as a rounding error at best and a lie at worst, and the entire product rests
  // on every figure being checkable against the thing it came from.
  const detail = extendedBy
    ? `${hardYears.toFixed(1)} years back from your ${winner.label}, and further still on your ${extendedBy}. Counts as ${years.toFixed(1)}.`
    : `${years.toFixed(1)} years back, from your ${winner.label}.`;

  return {
    component: { key: "age", label: "Age", points: round(points), max: 30, detail },
    oldest: {
      date: winner.date.toISOString(),
      years: round(yearsSince(winner.date)),
      source: winner.label,
    },
  };
}

/**
 * CONTINUITY (max 25). Distinct months you were actually present for.
 *
 * Back from the dead. v1 cut this because per-item timestamps were unreachable
 * on the web path; on desktop they are everywhere.
 *
 * TWO factors, because either one alone is trivially gamed.
 *
 * Absolute months stop a six-month-old account claiming perfect attendance: six
 * out of six is 100% coverage and means nothing. Full marks need eight years of
 * months on the board.
 *
 * Coverage stops an old account with one active year from riding its age: 12
 * active months across a 12-year span is a person who showed up once and left.
 *
 * Multiplied rather than averaged, because a failure on either axis should be a
 * failure, not something the other axis can compensate for.
 */
function continuityComponent(evidence: Evidence, oldest: PatinaScore["oldestSignal"]): Component {
  const months = mergeMonths(entries(evidence).map(([, source]) => source.months));
  const keys = Object.keys(months);
  const activeMonths = keys.length;

  if (activeMonths === 0) {
    return {
      key: "continuity",
      label: "Continuity",
      points: 0,
      max: 25,
      detail: oldest
        ? "Nothing dated came back, so we cannot see whether you kept showing up."
        : "Counts the separate months you have been active across.",
    };
  }

  // Span measured from the oldest thing we can see, whether that is an account
  // opening date or simply the earliest month in the histogram.
  const earliestMonth = keys.sort()[0];
  const elapsed = Math.max(
    1,
    oldest ? Math.round(oldest.years * 12) : monthsSinceKey(earliestMonth) + 1,
  );

  const coverage = Math.min(1, activeMonths / elapsed);
  const reach = Math.min(activeMonths / CONTINUITY_FULL_MONTHS, 1);
  const points = 25 * reach * coverage;

  const percent = Math.round(coverage * 100);
  const detail =
    activeMonths < 6
      ? `${activeMonths} active ${activeMonths === 1 ? "month" : "months"} so far. This climbs with time and nothing else.`
      : coverage < 0.35
        ? `${activeMonths} active months, but with long gaps: about ${percent}% of the time since you started.`
        : `Active in ${activeMonths} separate months, roughly ${percent}% of the time since you started.`;

  return { key: "continuity", label: "Continuity", points: round(points), max: 25, detail };
}

/**
 * CORROBORATION (max 15). How many sources INDEPENDENTLY prove a date.
 *
 * One old account could be bought. Two unrelated platforms both saying you have
 * been around since 2012 is a much more expensive thing to arrange, because the
 * attacker has to buy an aged account on each and they do not come in matched
 * sets.
 *
 * Each source counts for how OLD it is, not merely for existing. v1 learned this
 * the hard way: counting sources was worth 16 points to a farm whose every
 * account was a fortnight old, and three fresh profiles all agreeing they
 * started last Tuesday corroborate nothing.
 */
function corroborationComponent(evidence: Evidence): Component {
  const dated = entries(evidence)
    .flatMap(([, source]) => {
      const date = parseDate(source.earliest);
      return date ? [{ years: yearsSince(date), soft: source.softDate === true }] : [];
    });

  if (dated.length === 0) {
    return {
      key: "corroboration",
      label: "Corroboration",
      points: 0,
      max: 15,
      detail: "Connect a second dated account. Two proving the same thing is worth far more than one.",
    };
  }

  // Soft (self-reported) dates vote at half strength, for the same reason they
  // extend Age at half strength.
  const weight = dated.reduce(
    (sum, d) => sum + Math.min(d.years / CORROBORATION_FULL_YEARS, 1) * (d.soft ? 0.5 : 1),
    0,
  );
  const points = Math.min(15, weight * 7.5);

  const detail =
    points < 3
      ? "These accounts are too new to back each other up yet."
      : dated.length === 1
        ? "One account proves when you started. A second proving it separately is worth a lot more."
        : `${dated.length} accounts independently agree on how far back you go.`;

  return { key: "corroboration", label: "Corroboration", points: round(points), max: 15, detail };
}

/**
 * VOUCHES (max 12). Other people, at a known point in time.
 *
 * The component desktop exists to unlock. Not how many people follow you, which
 * is the single most purchasable number on the internet, but WHEN specific other
 * humans chose to associate with you. LinkedIn hands us `dateConnected` on every
 * connection; Steam hands us `friendSince` on every friend. An account farm's
 * social graph forms in one week. A real one smears across a decade.
 *
 * Each vouch counts for how long ago it happened, so buying 500 connections
 * today earns almost nothing, and the 40 people who added you in 2016 earn
 * almost everything.
 *
 * Raw follower counts survive here as the second, deliberately small term. This
 * is what became of v1's Standing component. It is worth at most 2 of the 100,
 * because it is flavour, not evidence.
 */
function vouchesComponent(evidence: Evidence): Component {
  const vouchMonths = mergeMonths(entries(evidence).map(([, source]) => source.vouchMonths));

  let datedWeight = 0;
  for (const [month, count] of Object.entries(vouchMonths)) {
    const yearsAgo = monthsSinceKey(month) / 12;
    datedWeight += count * Math.min(Math.max(0, yearsAgo) / VOUCH_FULL_YEARS, 1);
  }

  // Undated credits (GitHub orgs, badges, reactions received) count at half.
  // Somebody let you in, which is real, but we cannot tell whether it was a
  // decade ago or this morning.
  const undated = entries(evidence).reduce((sum, [, source]) => sum + num(source.vouches), 0);
  const followers = entries(evidence).reduce((sum, [, source]) => sum + num(source.followers), 0);

  const points = Math.min(
    12,
    saturate(datedWeight + undated * 0.5, 40, 10) + saturate(followers, 5000, 2),
  );

  const totalVouches = Object.values(vouchMonths).reduce((sum, n) => sum + n, 0);
  const detail = totalVouches
    ? `${totalVouches.toLocaleString()} people connected to you, going back years.`
    : undated
      ? `${undated} organisation or badge ${undated === 1 ? "credit" : "credits"}, plus your follower counts.`
      : followers
        ? `${followers.toLocaleString()} following you. Dated connections would be worth much more.`
        : "Other people choosing to connect to you, and when they did it.";

  return { key: "vouches", label: "Vouches", points: round(points), max: 12, detail };
}

/**
 * Concentration of activity across the months you were active, as a Gini
 * coefficient. 0 is perfectly even, 1 is everything in one month.
 *
 * Measured over ACTIVE months only. Sparsity is Continuity's job; this is a
 * different question, and one nothing else on the list can answer: of the months
 * you showed up, was your volume the steady drip of a life or a single dump?
 *
 * The attack this catches: four years of real but thin history, plus a recent
 * upload of 500 items. Continuity sees 48 good months. Depth sees 500 items.
 * Only this notices that ninety percent of the volume landed in one week.
 */
function giniOf(values: number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return 0;

  let weighted = 0;
  for (let i = 0; i < n; i += 1) weighted += (2 * (i + 1) - n - 1) * sorted[i];
  return weighted / (n * total);
}

/**
 * Turns that concentration into a multiplier on Depth, between 1.0 and 0.7.
 *
 * Nothing below a Gini of 0.6, because real people are genuinely lumpy: nobody
 * posts at a constant rate, and punishing a busy fortnight would be punishing
 * being human.
 */
function cadenceFactor(months: Months): number {
  const gini = giniOf(Object.values(months));
  return 1 - 0.3 * Math.min(1, Math.max(0, gini - 0.6) / 0.4);
}

/**
 * DEPTH (max 10). Volume of things you actually made.
 *
 * Halved from v1's 20, where it was overweighted purely because Continuity was
 * unreachable and something had to carry those points. Buyable in principle,
 * tedious in practice, and discounted by Cadence when the volume arrived all at
 * once.
 */
function depthComponent(evidence: Evidence, connected: number): Component {
  const kinds = entries(evidence)
    .flatMap(([, source]) => (Array.isArray(source.made) ? source.made : []))
    .filter((kind) => kind && num(kind.count) > 0 && typeof kind.label === "string");

  const made = kinds.reduce((sum, kind) => sum + num(kind.count), 0);
  const months = mergeMonths(entries(evidence).map(([, source]) => source.months));
  const cadence = cadenceFactor(months);

  const parts = kinds.map((kind) => `${num(kind.count).toLocaleString()} ${kind.label}`);

  const base = saturate(made, 100, 10) * cadence;

  const detail = parts.length
    ? cadence < 0.9
      ? `${parts.join(", ")}. Most of it arrived in a short burst, so it counts for less.`
      : `${parts.join(", ")}.`
    : connected === 0
      ? "Counts the posts, videos, repositories and orders you have made."
      : "Nothing made yet on the sources you connected.";

  return { key: "depth", label: "Depth", points: round(base), max: 10, detail };
}

/**
 * BREADTH (max 8). Independent accounts backing each other up.
 *
 * Faking one account is easy. Faking six, each with its own years of history, is
 * a different job entirely. The curve is steepest on the second and third source
 * because that is where the cost to an attacker rises fastest, and it reaches
 * ten now rather than v1's five, because desktop opened ten sources.
 */
function breadthComponent(sources: SourceId[]): Component {
  const table = [0, 2, 4, 5.5, 6.5, 7, 7.5, 8, 8, 8, 8];
  const points = table[Math.min(sources.length, 10)];

  const detail =
    sources.length === 0
      ? "Independent accounts that back each other up."
      : sources.length === 1
        ? "One source. Add another and this climbs fast."
        : `${sources.length} independent accounts telling the same story.`;

  return { key: "breadth", label: "Breadth", points: round(points), max: 8, detail };
}

/**
 * Everything except the time signals is gated behind this.
 *
 * An account farm can manufacture depth, vouches and breadth in an afternoon:
 * open six accounts, bulk-upload, buy 3,000 followers, add each other as
 * friends. What it cannot manufacture is the time underneath them.
 *
 * v1 gated on Age and Corroboration. v2 gates on Age and Continuity, which are
 * now the two components that actually measure elapsed time.
 *
 * The 0.15 floor is deliberate and stays. A nineteen-year-old with a genuine
 * three-year account is not a fraud, and should not be flattened to zero for
 * being young.
 */
function timeFactor(age: Component, continuity: Component): number {
  const raw = 0.5 * (age.points / age.max) + 0.5 * (continuity.points / continuity.max);
  return 0.15 + 0.85 * Math.min(1, raw);
}

export function scorePatina(evidence: Evidence): PatinaScore {
  const sourcesConnected = entries(evidence).map(([id]) => id);

  const { component: age, oldest } = ageComponent(evidence);
  const continuity = continuityComponent(evidence, oldest);
  const corroboration = corroborationComponent(evidence);
  const factor = timeFactor(age, continuity);

  // Time is earned outright. Everything else is only worth what time backs.
  // The gating note is suppressed before anything is connected, where it would
  // just be noise attached to a row of zeroes.
  const gated = [
    vouchesComponent(evidence),
    depthComponent(evidence, sourcesConnected.length),
    breadthComponent(sourcesConnected),
  ].map((component) => ({
    ...component,
    points: round(component.points * factor),
    detail:
      factor < 0.5 && sourcesConnected.length > 0
        ? `${component.detail} Counted at ${Math.round(factor * 100)}% until there is more history behind it.`
        : component.detail,
  }));

  const components = [age, continuity, corroboration, ...gated];
  const total = Math.round(components.reduce((sum, c) => sum + c.points, 0));

  const datedSources = entries(evidence).filter(([, s]) => parseDate(s.earliest) !== null).length;
  const provisionalReason =
    sourcesConnected.length < FLOOR_SOURCES
      ? `Connect ${FLOOR_SOURCES - sourcesConnected.length} more ${
          FLOOR_SOURCES - sourcesConnected.length === 1 ? "source" : "sources"
        } to make this shareable.`
      : datedSources < FLOOR_DATED_SOURCES
        ? "Connect another account that carries a date, so this can be independently backed up."
        : null;

  return {
    total,
    components,
    oldestSignal: oldest,
    sourcesConnected,
    provisional: provisionalReason !== null,
    provisionalReason,
  };
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
