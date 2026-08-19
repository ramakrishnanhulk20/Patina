import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { safeEqual } from "./safe-equal.ts";

/**
 * The gate on the admin area.
 *
 * Deliberately NOT Google sign-in. Gating on an email would mean requesting the
 * email scope from every person who signs in, and the privacy page promises the
 * opposite: Patina asks Google for `openid` and nothing else. Making every user
 * hand over their email address so that one operator can be recognised is a bad
 * trade, so the operator gets a password instead and users are left alone.
 *
 * The cookie never carries the password. It carries an HMAC derived from it, so
 * a stolen cookie cannot be turned back into the secret, and rotating
 * ADMIN_PASSWORD invalidates every session that was issued under the old one.
 *
 * Fails CLOSED. With no ADMIN_PASSWORD set the admin area is unreachable rather
 * than open, which is the only safe direction for a page that lists real users
 * and their payout addresses.
 */

export const ADMIN_COOKIE = "patina_admin";

function secret(): string | undefined {
  return process.env.ADMIN_PASSWORD;
}

export function adminConfigured(): boolean {
  return Boolean(secret());
}

/** The value a valid admin cookie must hold. Derived, never the password itself. */
export function adminCookieValue(): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update("patina-admin-v1").digest("hex");
}

/** Does this request carry a valid admin session? */
export async function isAdmin(): Promise<boolean> {
  const expected = adminCookieValue();
  if (!expected) return false;

  const store = await cookies();
  const offered = store.get(ADMIN_COOKIE)?.value;
  if (!offered) return false;

  return safeEqual(offered, expected);
}

/** Is this the right password? Constant-time, so it cannot be guessed by timing. */
export function passwordMatches(offered: string): boolean {
  const key = secret();
  if (!key) return false;
  return safeEqual(offered, key);
}
