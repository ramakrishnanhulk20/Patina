/**
 * Other apps a person can spend their connected data on.
 *
 * Built for the Vana Cup, where data WE brought into the network being read by
 * someone else's app scored double a sign-up. Sending our users onward was
 * therefore worth more than keeping them, and chasing that is what won it.
 *
 * The scoring is gone and the list stays, because the reason underneath it was
 * never the competition. Patina's entire claim is that data connected here is
 * portable, and this is the one place a person can watch that be true. We get
 * nothing from these apps and they get nothing from us.
 */

import { PATINA_APP_ADDRESS } from "./patina-address";

const LEADERBOARD = "https://builders.vana.org/api/leaderboard";

/** Our own app, so we never recommend ourselves. */
const SELF = PATINA_APP_ADDRESS;

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
const EXCLUDED = new Set<string>([
  "0x2e33eb51c66bdb08af8c0f6add45a85270695a5b", // HOE-KEMON
  "0x8e2a73b478600f529aaa2f697f210f360cfba23c", // Ministry of Gay
  "0xc1d34c9c20820000542eec182dde7cbc5d01ac83", // My Little Psychosis
]);

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
