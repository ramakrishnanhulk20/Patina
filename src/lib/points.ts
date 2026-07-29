/**
 * The two numbers that decide the leaderboard, in a file with no imports.
 *
 * They live here rather than in store.ts because CLIENT COMPONENTS NEED THEM.
 * store.ts imports `@upstash/redis`, so anything importing it drags a Redis
 * client into the browser bundle — which is why ShareCard used to carry its own
 * hand-copied `const POINTS_PER_REFERRAL = 10` under a "keep in sync with
 * store.ts" comment. That comment is an admission that the arrangement will
 * eventually drift, and drift here means the share panel promising a different
 * number from the one the standings actually pay out on.
 *
 * Nothing may be imported into this file. That constraint is the feature.
 */

/**
 * The score an invited person must reach before their referrer gets credit.
 *
 * Without a bar like this, a reward-bearing referral link is an invitation to
 * farm: register two hundred throwaway accounts, collect two hundred credits.
 * A throwaway scores about 2 and a genuinely young but real person scores about
 * 30, so 20 separates them with room to spare and without punishing anyone for
 * being nineteen.
 */
export const REFERRAL_QUALIFIES_AT = 20;

/**
 * What one real person you bring is worth in LEADERBOARD POINTS.
 *
 * Points and the Patina score are deliberately different numbers, and conflating
 * them would wreck both. The score is evidence about YOU: how far back your
 * history goes, and nothing else may touch it, or the card stops meaning
 * anything. Points are score plus contribution, and they decide only one thing,
 * which is whether you are in the places that share the reward.
 *
 * So being top of the leaderboard says "did the most for this", not "is the most
 * human". Those are different claims and the pages say so.
 *
 * Ten is chosen against the real spread: a long history scores about 90 and a
 * typical one about 40, so five genuine people you brought is worth roughly what
 * a decade of your own history is worth. That feels right, and it matches what
 * the competition itself rewards, where a new person is worth up to four goals.
 */
export const POINTS_PER_REFERRAL = 10;

/** The number the leaderboard ranks on. */
export function leaguePoints(score: number, qualifiedReferrals: number): number {
  // Coerce hard. Older profiles may lack `referrals`, and Math.max(0, undefined)
  // is NaN — which would write a broken rank and show as "2 points / 78 score".
  const safeScore = Number.isFinite(score) ? score : 0;
  const safeRefs = Number.isFinite(qualifiedReferrals) ? Math.max(0, qualifiedReferrals) : 0;
  return Math.round(safeScore + POINTS_PER_REFERRAL * safeRefs);
}
