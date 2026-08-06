/**
 * Where Patina actually stands in the Vana Cup, read live.
 *
 * The reward pitch rests on a public leaderboard nobody could see without
 * leaving the app: the terms say "check where it stands whenever you like", and
 * then gave people nowhere to check. This closes that. It also does the real
 * work of the product's distribution. The Cup is scored by users brought in,
 * so a visible "we are 5th, one place from the money" is the thing that turns a
 * reader into a sharer.
 *
 * The Cup API is a third party we do not control, so everything here is written
 * to FAIL SOFT: a timeout, a shape change, or Patina simply not being on the
 * board all resolve to `null`, and the component renders nothing rather than
 * taking a page down. Same discipline as ecosystem.ts.
 */

const LEADERBOARD = "https://builders.vana.org/api/leaderboard";
const PRIZE = "https://builders.vana.org/api/prize";

/**
 * Patina's registered mainnet app address, lowercased for comparison.
 *
 * The one identifier that cannot drift: names get edited, this does not. Shared
 * with ecosystem.ts, which needs the same address to avoid recommending us to
 * ourselves.
 */
export const PATINA_APP_ADDRESS = "0x620ddbecead28bbf1b979bfab8e3a7b893aa54a1";

/**
 * How many places share the Cup prize. Champion plus second-through-fifth, from
 * the Cup's own prize structure (one champion payout, four runner-up payouts).
 *
 * NOT the same number as REWARD.places (50), which is how many of OUR users
 * split OUR share. This is the builders' leaderboard; that is Patina's own.
 */
export const CUP_PAYING_PLACES = 5;

export type CupStanding = {
  /** Patina's place on the builders' leaderboard, 1-based. */
  rank: number;
  /** How many builders are on the board, for "#5 of 21". */
  total: number;
  points: number;
  goals: number;
  assists: number;
  /** People who connected data through Patina. */
  users: number;
  /** Inside the places that share the Cup prize. */
  inTheMoney: boolean;
  /** Holding the LAST paying place. In, but one slip from out. */
  onTheBubble: boolean;
  /**
   * The number that creates urgency. When inside, points clear of the first
   * non-paying place. When outside, points needed to reach the cutoff. Zero
   * when the relevant neighbour is level on points.
   */
  margin: number;
  marginDirection: "clear" | "behind";
  /** Live champion payout in VANA, which grows with network activity. Null if unread. */
  championVana: number | null;
  /** False once the season has closed, so the label can stop saying "live". */
  seasonLive: boolean;
};

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** One builder row, read defensively: any missing number becomes 0, never NaN. */
type Row = { rank: number; app: string; name: string; points: number };

function toRow(raw: unknown): Row | null {
  if (!isObject(raw)) return null;
  const rank = num(raw.rank);
  const points = num(raw.points);
  if (rank === null || points === null) return null;
  return {
    rank,
    points,
    app: typeof raw.app === "string" ? raw.app.toLowerCase() : "",
    name: typeof raw.name === "string" ? raw.name : "",
  };
}

export async function cupStanding(): Promise<CupStanding | null> {
  try {
    // Prize is a bonus; a failure there must not lose us the standing, so it is
    // caught separately and degrades to null rather than rejecting the pair.
    const [board, prize] = await Promise.all([
      fetch(LEADERBOARD, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) }),
      fetch(PRIZE, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) }).catch(
        () => null,
      ),
    ]);

    if (!board.ok) return null;
    const body = (await board.json()) as Json;

    const builders = Array.isArray(body.builders) ? body.builders : [];
    const rows = builders
      .map(toRow)
      .filter((row): row is Row => row !== null)
      .sort((a, b) => a.rank - b.rank);

    if (rows.length === 0) return null;

    const patina =
      rows.find((row) => row.app === PATINA_APP_ADDRESS) ??
      rows.find((row) => row.name.toLowerCase() === "patina");
    if (!patina) return null;

    const inTheMoney = patina.rank <= CUP_PAYING_PLACES;
    const onTheBubble = patina.rank === CUP_PAYING_PLACES;

    // Margin is measured against the neighbour that matters: the first team
    // outside the money if we are in, the last team inside it if we are out.
    let margin = 0;
    let marginDirection: "clear" | "behind" = "clear";
    if (inTheMoney) {
      const firstOut = rows.find((row) => row.rank === CUP_PAYING_PLACES + 1);
      margin = firstOut ? Math.max(0, patina.points - firstOut.points) : patina.points;
      marginDirection = "clear";
    } else {
      const cutoff = rows.find((row) => row.rank === CUP_PAYING_PLACES);
      margin = cutoff ? Math.max(0, cutoff.points - patina.points) : 0;
      marginDirection = "behind";
    }

    let championVana: number | null = null;
    let seasonLive = true;
    if (prize?.ok) {
      const p = (await prize.json().catch(() => null)) as Json | null;
      championVana = p ? num(p.championPayout) : null;
    }
    if (isObject(body.season) && typeof body.season.status === "string") {
      seasonLive = body.season.status === "live";
    }

    return {
      rank: patina.rank,
      total: rows.length,
      points: patina.points,
      goals: readNum(builders, patina.rank, "goals"),
      assists: readNum(builders, patina.rank, "assists"),
      users: readNum(builders, patina.rank, "users"),
      inTheMoney,
      onTheBubble,
      margin,
      marginDirection,
      championVana,
      seasonLive,
    };
  } catch {
    // Network, timeout, or a shape we did not expect. The page carries on
    // without the scoreboard rather than failing for everyone.
    return null;
  }
}

/** Pull a numeric field off the original builder row for Patina's rank. */
function readNum(builders: unknown[], rank: number, key: string): number {
  const row = builders.find((b) => isObject(b) && num(b.rank) === rank);
  return isObject(row) ? (num(row[key]) ?? 0) : 0;
}
