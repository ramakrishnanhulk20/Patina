import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { safeEqual } from "./safe-equal.ts";

/**
 * Who is allowed to see the inside of Patina.
 *
 * There is exactly one operator, so there is exactly one password and no user
 * table, no roles and no invitations. Building an account system for an
 * audience of one is how a dashboard takes a week instead of an afternoon.
 *
 * WHAT THIS IS NOT. It is not a login for the product. Patina deliberately has
 * no accounts and this does not change that: the admin pages are a separate
 * surface that ordinary visitors never see, excluded from search engines, and
 * reachable only by somebody holding a password that lives in an environment
 * variable.
 *
 * FAILS CLOSED. With no password configured, every admin route 404s rather
 * than opening. The opposite default, which is the easy one to write by
 * accident, would mean a deployment that forgot the variable published its user
 * numbers to anybody who guessed the path.
 */

const COOKIE = "patina_admin";
const SESSION_HOURS = 12;

function secret(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value && value.length > 0 ? value : null;
}

/** Whether an admin surface should exist at all on this deployment. */
export function adminConfigured(): boolean {
  return secret() !== null;
}

/**
 * The value the cookie has to hold.
 *
 * A hash of the password rather than the password itself, so the browser never
 * stores the thing that would let somebody log in again elsewhere, and so
 * rotating the password invalidates every existing session for free. Dated to
 * the hour block it was issued in, which is what makes it expire server-side
 * rather than only when the browser feels like dropping the cookie.
 */
function expectedToken(hoursAgo = 0): string | null {
  const password = secret();
  if (!password) return null;
  const block = Math.floor(Date.now() / 3_600_000) - hoursAgo;
  return createHmac("sha256", password).update(`admin:${block}`).digest("hex");
}

/** True when this request carries a valid, unexpired admin session. */
export async function isAdmin(): Promise<boolean> {
  if (!adminConfigured()) return false;

  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;

  /**
   * Accept any hour block inside the session window.
   *
   * A token is stamped with the hour it was minted in, so checking only the
   * current hour would sign somebody out at the top of every hour, which is
   * both useless and the kind of thing that gets a dashboard abandoned. Walking
   * back over the window is what turns an hourly stamp into a real session
   * length, and every comparison is constant time.
   */
  for (let back = 0; back <= SESSION_HOURS; back += 1) {
    const token = expectedToken(back);
    if (token && safeEqual(value, token)) return true;
  }
  return false;
}

/**
 * Check a submitted password and start a session if it is right.
 *
 * Compared with `safeEqual` rather than `===`, because a plain comparison
 * returns as soon as two characters differ and leaks how much of the password
 * the caller already has.
 */
export async function signIn(password: string): Promise<boolean> {
  const expected = secret();
  if (!expected) return false;
  if (!safeEqual(password, expected)) return false;

  const token = expectedToken();
  if (!token) return false;

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return true;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
