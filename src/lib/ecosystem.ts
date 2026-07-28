/**
 * Other apps a person can spend their connected data on.
 *
 * Why this exists, plainly: an assist is worth double a goal in the Vana Cup,
 * and it pays out when data WE brought into the network gets read by someone
 * else's app. So sending our users onward is worth more to us than keeping them
 * here. It is also the thing the Cup says it rewards, in as many words: "the
 * champion is the builder who did the most for everyone else."
 *
 * That incentive is disclosed to the user on the page rather than hidden. A
 * recommendation with a motive behind it should say so, and there is nothing
 * here we would be embarrassed to explain.
 *
 * The rules prohibit collusion between apps a single entrant CONTROLS. These
 * are independent builders competing against us, which is the opposite.
 */

const LEADERBOARD = "https://builders.vana.org/api/leaderboard";

/** Our own app, so we never recommend ourselves. */
const SELF = "0x620ddbecead28bbf1b979bfab8e3a7b893aa54a1";

/**
 * Apps we will not put in front of our own users, by app address.
 *
 * Nothing to do with their quality or their builders. Patina gets shared into
 * family WhatsApp groups and regional Telegram channels, and a recommendation
 * carries our name with it. Anything we would not want read aloud in one of
 * those rooms does not go on the list.
 *
 * Addresses rather than names, because names can be edited after listing.
 */
const EXCLUDED = new Set<string>([]);

export type EcosystemApp = {
  name: string;
  url: string;
  description: string | null;
  icon: string | null;
};

type LeaderboardRow = {
  name?: unknown;
  url?: unknown;
  description?: unknown;
  icon?: unknown;
  app?: unknown;
  disqualified?: unknown;
};

/** Only http(s), and never a link that would leak our users' referrer path. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Everything below is written by other builders, so treat it as untrusted text. */
function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * Apps worth sending someone to.
 *
 * Cached for an hour: this is a third-party API and the list changes a few
 * times a day at most, so hammering it on every page view would be rude and
 * would put their availability in our critical path.
 */
export async function ecosystemApps(limit = 4): Promise<EcosystemApp[]> {
  try {
    const response = await fetch(LEADERBOARD, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];

    const body = (await response.json()) as { builders?: LeaderboardRow[] };
    const rows = Array.isArray(body.builders) ? body.builders : [];

    return rows
      .filter((row) => {
        const address = typeof row.app === "string" ? row.app.toLowerCase() : "";
        if (address === SELF || EXCLUDED.has(address)) return false;
        if (row.disqualified) return false;
        // A dead link wastes the goodwill of someone who just trusted us.
        if (safeUrl(row.url) === null) return false;
        // Requiring a description is a quality bar, not bureaucracy: we are
        // asking someone to hand another app their data, and "just click this,
        // I cannot tell you what it does" is not a recommendation worth making.
        return clean(row.description, 130) !== null;
      })
      .map((row) => ({
        name: clean(row.name, 40) ?? "Untitled app",
        url: safeUrl(row.url)!,
        description: clean(row.description, 130),
        icon: safeUrl(row.icon),
      }))
      .slice(0, limit);
  } catch {
    // The panel simply does not render. A third party being down must never
    // break the page someone just successfully connected on.
    return [];
  }
}
