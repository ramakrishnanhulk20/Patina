import { REFERRAL_QUALIFIES_AT } from "./points.ts";

/**
 * The reward, now that it is owed rather than promised.
 *
 * Patina won the Vana Cup on 18 August 2026. Everything in this file used to
 * describe a competition that might pay out; it now describes a payout that is
 * due, and nothing else.
 *
 * No figure appears here for what the pool is worth, deliberately. Quoting a
 * token amount on a public page is a compliance exposure, and the promise that
 * was actually made was a SHARE of the winnings rather than a number. The share
 * is stated; the arithmetic is not.
 */

/**
 * The claim window, in UTC.
 *
 * Stored as absolute instants rather than a local time and a timezone, because
 * "3PM" means five different moments to five different readers and getting it
 * wrong costs somebody their share. These are 15:00 and 03:00 India Standard
 * Time (UTC+5:30) on the 19th and 20th of August 2026.
 *
 * The window is enforced on the server, in the claim route. Anything the page
 * shows is a courtesy on top of that: a client clock can be wrong, or lied to,
 * and neither may decide whether a claim is accepted.
 */
export const CLAIM_OPENS_AT = "2026-08-19T09:30:00.000Z";
export const CLAIM_CLOSES_AT = "2026-08-19T21:30:00.000Z";

export type ClaimWindow = "before" | "open" | "closed";

export function claimWindowState(now: Date = new Date()): ClaimWindow {
  const t = now.getTime();
  if (t < Date.parse(CLAIM_OPENS_AT)) return "before";
  if (t >= Date.parse(CLAIM_CLOSES_AT)) return "closed";
  return "open";
}

export const REWARD = {
  /** Share of the winnings that goes back to the people who connected. */
  shareOfWinnings: 0.5,

  /** How many people are eligible, ranked by points at the final whistle. */
  places: 50,

  /** Where Patina finished. */
  finished: "1st of 43 apps",

  /** Final points at the whistle, for anyone who wants to check the maths. */
  finalPoints: 4707,

  /** When the standings were frozen and eligibility was decided. */
  snapshotAt: "18 August 2026",

  /** How the claim window reads to a person, in the operator's own timezone. */
  windowLabel: "19 August, 3:00pm IST to 20 August, 3:00am IST",

  /** The public commitment on when claims are settled. */
  paidBy: "31 August 2026",

  /** Score an invited person had to reach for their referrer to be credited. */
  referralQualifiesAt: REFERRAL_QUALIFIES_AT,
} as const;
