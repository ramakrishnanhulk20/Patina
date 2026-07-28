import { cookies } from "next/headers";
import { newProfileId } from "./store";

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
 */

const COOKIE = "patina_sid";
const REF_COOKIE = "patina_ref";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** The referral code this visitor arrived with, parked by proxy.ts. */
export async function readReferralCode(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REF_COOKIE)?.value || undefined;
}

/** Read the current session id without creating one. */
export async function readSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/**
 * Read the session id, creating one if needed.
 *
 * Only callable where Next allows a cookie to be set (route handlers and
 * server actions). Calling it while rendering a page throws, which is why
 * pages use readSessionId instead.
 */
export async function ensureSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;

  const id = newProfileId();
  store.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return id;
}
