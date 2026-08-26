import { Redis } from "@upstash/redis";

/**
 * Counting what happens, without watching who it happens to.
 *
 * WHY THIS IS NOT AN ANALYTICS SCRIPT. Patina's whole pitch is that it does not
 * hand your data to anyone, and the connect page is exactly where that promise
 * has to hold. Loading a third-party tracker there would buy a funnel chart at
 * the cost of the argument the product is selling, and hand every critic a free
 * point. So nothing runs in the browser, no third party is involved, there is
 * no cookie banner to write, and there is nothing here to leak: every counter
 * is a single integer that goes up.
 *
 * It works because every step worth measuring already crosses this server. A
 * connection is requested here, read here, refused here and named here. The
 * expensive half of a product-analytics tool is following somebody between
 * pages, and that is precisely the half Patina must not have.
 *
 * WHAT IT DELIBERATELY CANNOT DO is tell you about a person. There is no id, no
 * session, no address, no user agent and no join between events. You can learn
 * that forty people started and eleven finished. You cannot learn which eleven,
 * and neither can anyone who reads the database.
 */

/**
 * Every counter, named once.
 *
 * A closed list rather than free-form strings, for two reasons. It means the
 * admin page can render the funnel without scanning the keyspace for whatever
 * happens to be there, and it means a typo at a call site is a type error
 * rather than a counter that silently records into a key nobody ever reads.
 */
export const METRICS = {
  /** A device that cannot run Vana Desktop reached the connect page. */
  handoff_shown: "Phone visits to Connect",
  /** An access request was created. The person is on their way to Vana. */
  connect_started: "Connections started",
  /** Every scope read and recorded. The person now has a score. */
  connect_finished: "Connections finished",
  /** The source had nothing in it. Usually an import that has not run. */
  read_empty: "Refused: source was empty",
  /** The proof scope did not come back, so ownership could not be shown. */
  read_unproven: "Refused: could not prove it was theirs",
  /** The read itself broke. Payment, network, or the Personal Server. */
  read_failed: "Failed: something broke",
  /**
   * The fee settled and the data still did not arrive.
   *
   * Tracked apart from read_failed because it is the only failure that costs
   * real money. A rising number here is escrow draining with nothing to show
   * for it, and it would otherwise be indistinguishable from an ordinary error.
   */
  read_paid_and_failed: "Failed after paying (money lost)",
  /** A public name was claimed, so the score became shareable. */
  name_claimed: "Names claimed",
  /** Somebody erased everything. Worth watching, not worth panicking about. */
  profile_deleted: "Profiles deleted",
  /** A profile was recovered on a new device without paying for a re-read. */
  profile_restored: "Profiles restored",
  /**
   * A grant served one scope and refused the others.
   *
   * The one assumption v2 rests on that has never been confirmed against a live
   * grant: that asking for four scopes in a single approval gets all four back.
   * It is what takes signup from twenty-one approval trips down to nine. If it
   * is wrong, the fallback is one request per scope, which is four times the
   * trips for the same money, and the only warning was a console line nobody
   * reads. Any number above zero here means go and look.
   */
  multi_scope_refused: "Grants that refused extra scopes",
} as const;

export type MetricName = keyof typeof METRICS;

const PREFIX = "patina:v2:metric";

/** Daily rows are kept for a quarter. Long enough to see a trend, short enough
 * that the key count stays trivial and nothing accumulates forever. */
const DAILY_TTL_SECONDS = 60 * 60 * 24 * 92;

let client: Redis | null | undefined;

function redis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Record that something happened.
 *
 * Never throws and never awaits anything the caller depends on. A counter is
 * worth having and is worth nothing at all compared to the request it is
 * counting, so if Redis is unreachable the number is simply lost and the person
 * connecting never finds out there was a problem. Losing a statistic is not a
 * reason to fail somebody's connection.
 *
 * The `source` breakdown is a second key rather than a field, because the
 * question "which source fails most" and the question "how many failed" want
 * different rows and joining them later is not worth the write.
 */
export async function count(name: MetricName, source?: string): Promise<void> {
  const store = redis();
  if (!store) return;

  const day = today();
  const keys = [`${PREFIX}:${name}`, `${PREFIX}:${name}:${day}`];
  if (source) keys.push(`${PREFIX}:${name}:src:${source}`);

  await Promise.all(
    keys.map(async (key) => {
      try {
        const value = await store.incr(key);
        // Only the dated keys expire. Totals and per-source rows are the
        // history, and history that deletes itself is not history.
        if (value === 1 && key.endsWith(day)) await store.expire(key, DAILY_TTL_SECONDS);
      } catch {
        // See above: a lost counter is not worth surfacing to anybody.
      }
    }),
  );
}

/**
 * Fire and forget, for call sites that must not wait.
 *
 * The read route holds the user's Personal Server open while it works, and that
 * window closes when they close the tab. Adding a round trip to Redis in the
 * middle of it to record a statistic would be spending the one thing that
 * cannot be spared.
 */
export function countAsync(name: MetricName, source?: string): void {
  void count(name, source).catch(() => {});
}

/**
 * How many of something happen on an average day lately.
 *
 * Exists so the escrow alarm can talk about TIME rather than about a count.
 * "193 connections left" means nothing on its own: it is months of runway for
 * a product with no users and four days for one with fifty a day. Only the
 * burn rate turns the balance into a decision.
 *
 * Today is excluded. It is a partial day, and dividing by it would make the
 * rate swing wildly every morning and settle every evening, which is the
 * fastest way to build an alarm nobody believes.
 */
export async function dailyRate(name: MetricName, days = 7): Promise<number> {
  const store = redis();
  if (!store) return 0;

  const window = lastDays(days + 1).slice(0, days);
  try {
    const values = await store.mget<Array<number | null>>(
      ...window.map((day) => `${PREFIX}:${name}:${day}`),
    );
    const total = (values ?? []).reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
    return total / days;
  } catch {
    // A rate we cannot read is reported as no usage, which makes the alarm
    // fall back to its absolute floor rather than inventing a burn rate.
    return 0;
  }
}

export type MetricRow = {
  name: MetricName;
  label: string;
  total: number;
  /** Oldest day first, so a chart reads left to right. */
  daily: Array<{ day: string; value: number }>;
};

export type FunnelReport = {
  available: boolean;
  rows: MetricRow[];
  bySource: Record<string, Record<string, number>>;
  days: string[];
};

function lastDays(howMany: number): string[] {
  const out: string[] = [];
  for (let back = howMany - 1; back >= 0; back -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - back);
    out.push(date.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Every counter, plus the last fortnight day by day.
 *
 * One `mget` per metric rather than a key scan: the names are known ahead of
 * time, so there is no reason to ask the database what exists.
 */
export async function funnel(dayCount = 14): Promise<FunnelReport> {
  const store = redis();
  const days = lastDays(dayCount);
  const names = Object.keys(METRICS) as MetricName[];

  if (!store) {
    return {
      available: false,
      days,
      bySource: {},
      rows: names.map((name) => ({
        name,
        label: METRICS[name],
        total: 0,
        daily: days.map((day) => ({ day, value: 0 })),
      })),
    };
  }

  const sources = ["github", "linkedin", "spotify", "instagram", "youtube", "amazon", "uber", "doordash", "shop"];
  const bySource: Record<string, Record<string, number>> = {};

  const rows = await Promise.all(
    names.map(async (name): Promise<MetricRow> => {
      const keys = [`${PREFIX}:${name}`, ...days.map((day) => `${PREFIX}:${name}:${day}`)];
      let values: Array<number | null> = [];
      try {
        values = await store.mget<Array<number | null>>(...keys);
      } catch {
        values = [];
      }

      // Per-source rows only matter for the outcomes, and only for the metrics
      // that carry one. Asking for the rest would be nine wasted reads apiece.
      if (name === "connect_finished" || name === "read_empty" || name === "read_unproven" || name === "read_failed") {
        try {
          const perSource = await store.mget<Array<number | null>>(
            ...sources.map((source) => `${PREFIX}:${name}:src:${source}`),
          );
          bySource[name] = Object.fromEntries(
            sources.map((source, index) => [source, Number(perSource?.[index] ?? 0)]),
          );
        } catch {
          bySource[name] = {};
        }
      }

      return {
        name,
        label: METRICS[name],
        total: Number(values?.[0] ?? 0),
        daily: days.map((day, index) => ({ day, value: Number(values?.[index + 1] ?? 0) })),
      };
    }),
  );

  return { available: true, days, bySource, rows };
}
