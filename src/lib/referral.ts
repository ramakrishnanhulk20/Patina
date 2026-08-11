/**
 * What a referral code looks like, in exactly one place.
 *
 * Three layers have to agree on this: the proxy that parks an inbound code in a
 * cookie, the connect route that reads it back to credit someone, and the
 * client that mirrors it into localStorage as a mobile safety net. A second
 * copy of the rule drifting from the first is a silent referral leak, a code
 * accepted on capture and rejected on read, or the reverse, so it lives here and
 * is imported everywhere it is needed.
 *
 * NOTHING may be imported into this file. The proxy runs in the middleware/edge
 * runtime and must not pull in a server store, and this module is bundled into
 * the browser too. Keeping it dependency-free is what lets all three reach for
 * it. (Same discipline, same reason, as points.ts.)
 */

/**
 * Codes are minted from the alphabet [a-z2-9] and are seven characters long
 * (see newReferralCode in store.ts). The 4–16 window is deliberately looser than
 * that so a future change to the code length does not have to be made in two
 * files at once, while still rejecting anything that is plainly not one of ours.
 */
export const REFERRAL_CODE = /^[a-z2-9]{4,16}$/;

/**
 * Where the client keeps its own copy of the code.
 *
 * The proxy's cookie is httpOnly and, on some mobile in-app browsers, not
 * dependable across the Vana approval round trip. localStorage read straight off
 * the URL is not subject to either limit, so it is a second home the connect
 * request can read back explicitly.
 */
export const REFERRAL_STORAGE_KEY = "patina:v1:ref";

/**
 * A trimmed, lowercased code, or undefined when it is missing or malformed.
 *
 * Lowercasing here matters: codes are compared and stored lowercase everywhere
 * (see codeKey), and a link that arrives with a stray capital must still resolve
 * to the same referrer rather than silently crediting nobody.
 */
export function normalizeReferralCode(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const clean = raw.trim().toLowerCase();
  return REFERRAL_CODE.test(clean) ? clean : undefined;
}
