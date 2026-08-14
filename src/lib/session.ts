import { cookies } from "next/headers";

/**
 * Who we think you are, which is deliberately almost nothing.
 *
 * Patina never asks for a wallet, an email or a name to give you a score. The
 * moment of connecting is exactly where people give up, so we ask for nothing
 * there and only collect a payout address later, if and when someone claims a
 * share. All this cookie does is let you come back and find your own result.
 *
 * It is not an anti-fraud mechanism and is not treated as one. Anyone can clear
 * it and start again. Reward eligibility keys off the underlying account
 * identity instead (see identityOf in normalize.ts), which cannot be reset.
 *
 * WHAT IT IS, THOUGH, IS A BEARER CREDENTIAL. Whoever holds this value is
 * treated as that person for every route that reads a profile. That is the
 * reason for everything below.
 */

const COOKIE = "patina_sid";
const REF_COOKIE = "patina_ref";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The shape of a session token, and why it has a prefix.
 *
 * This cookie used to hold a bare profile id, which made the identifier and the
 * credential the same string. Profile ids are not secret: they were rendered as
 * React keys on the standings page, and React serialises keys into the payload
 * it ships to every browser. So the public leaderboard published a working
 * credential for each of its top entries, and anyone who read one could adopt
 * that profile, rename it, or delete it.
 *
 * Two things fix that, and both are needed:
 *
 *  1. A session token is now minted independently of any profile and is only
 *     ever meaningful through the link table. Knowing a profile id no longer
 *     tells you anything you can present as a credential.
 *  2. The `s1.` prefix puts tokens in a namespace a profile id can never
 *     occupy, so the two can never again be confused for one another, and a
 *     future change cannot quietly reintroduce the equivalence.
 *
 * The prefix also does the migration. Every previously issued cookie holds a
 * bare 32-character profile id, which fails this test, so every session issued
 * before this change stops being honoured the moment it deploys. That is
 * deliberate: those values were published, and there is no way to tell a person
 * holding their own from a person holding one they scraped. Signing in with
 * Google restores a profile in full. A profile that never signed in is no
 * longer reachable, which is the accepted cost of revoking a leaked credential.
 */
const TOKEN_PATTERN = /^s1\.[0-9a-f]{48}$/;

function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `s1.${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** The referral code this visitor arrived with, parked by proxy.ts. */
export async function readReferralCode(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REF_COOKIE)?.value || undefined;
}

/**
 * Read the current session token without creating one.
 *
 * Anything that is not a token this server would issue is treated as no session
 * at all, rather than being passed down to the store as a lookup key. That is
 * what stops a caller nominating an arbitrary string (a scraped profile id, a
 * guess, a value they minted themselves) and having the rest of the app treat
 * it as an identity.
 */
export async function readSessionId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  return value && TOKEN_PATTERN.test(value) ? value : null;
}

/**
 * Read the session token, creating one if needed.
 *
 * Only callable where Next allows a cookie to be set (route handlers and
 * server actions). Calling it while rendering a page throws, which is why
 * pages use readSessionId instead.
 */
export async function ensureSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing && TOKEN_PATTERN.test(existing)) return existing;

  const token = newSessionToken();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return token;
}
