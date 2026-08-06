import { REFERRAL_QUALIFIES_AT } from "./points.ts";

/**
 * The incentive, in one place.
 *
 * Every number a visitor is shown comes from here: the landing page, the share
 * panel and the terms page all read these constants. A reward promise that says
 * one thing on the homepage and another on the terms page is worse than no
 * promise at all, and keeping three copies in sync by hand never works.
 *
 * Stated in VANA rather than dollars on purpose. The prize pays in VANA, so
 * quoting a dollar figure would mean promising to cover the exchange rate
 * between now and the payout.
 */

export const REWARD = {
  /** Share of anything Patina wins that goes back to the people who connected. */
  shareOfWinnings: 0.5,

  /** How many people are eligible, ranked by leaderboard points. */
  places: 50,

  /** Prize for finishing first, from the Vana Cup terms. Grows with network activity. */
  championPrize: 5000,

  /** Prize for each of second through fifth. */
  runnerUpPrize: 500,

  /** Competition close, from the Vana Cup official terms. */
  cupClosesAt: "18 August 2026",

  /** What we commit to publicly. Deliberately later than we expect to need. */
  paidBy: "31 August 2026",

  /** Score an invited person must reach before their referrer gets a share. */
  referralQualifiesAt: REFERRAL_QUALIFIES_AT,

  /**
   * Reference price used ONLY to show people roughly what a share is worth.
   * Most visitors have never heard of VANA, and "50 VANA" means nothing to them.
   *
   * Deliberately a fixed, dated figure rather than a live feed. The promise
   * itself is denominated in VANA, so a live ticker would imply we are
   * guaranteeing a dollar amount we cannot control. Every place this appears
   * says the date out loud.
   *
   * To update: change these two lines. Nothing else references the rate.
   */
  vanaUsd: 1.23,
  priceAsOf: "28 July 2026",
} as const;

/** "$61". Whole dollars, because false precision on an estimate reads as a promise. */
export function usd(vana: number): string {
  return `$${Math.round(vana * REWARD.vanaUsd).toLocaleString("en-US")}`;
}

/** VANA each if the winning pool for a position is split `shares` equal ways. */
export function perShare(position: "champion" | "runnerUp", shares: number): number {
  const prize = position === "champion" ? REWARD.championPrize : REWARD.runnerUpPrize;
  const pool = prize * REWARD.shareOfWinnings;
  return pool / Math.max(shares, 1);
}

/**
 * A rough, honest illustration for the page.
 *
 * Everyone who finishes in the top `REWARD.places` by points takes an EQUAL cut
 * of the pool, one each, so this assumes a full board of `REWARD.places` and
 * divides evenly. Referrals decide WHO is in those places (each is worth points
 * on the leaderboard), never how many shares anyone holds, so no invite ever
 * makes an individual payout bigger. If anything this is a floor: fewer than
 * `REWARD.places` eligible people would divide the pool fewer ways and make each
 * cut larger. The copy has to say so rather than imply these are guarantees.
 */
export const ILLUSTRATION = {
  championPerShare: perShare("champion", REWARD.places),
  runnerUpPerShare: perShare("runnerUp", REWARD.places),
} as const;
