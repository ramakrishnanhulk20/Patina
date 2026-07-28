import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Catches a referral code off any page visit and parks it in a cookie.
 *
 * Someone arriving on patina.app/?r=abc123 might read the landing page, wander
 * to the reward section, and only connect several clicks later. The code has to
 * survive that, so it moves out of the URL and into a cookie on first sight.
 *
 * Note this runs before rendering and must not import anything from the app.
 * It only ever SETS the cookie, never reads it to make a decision, so there is
 * nothing here worth attacking.
 */

const COOKIE = "patina_ref";
const THIRTY_DAYS = 60 * 60 * 24 * 30;
const VALID = /^[a-z2-9]{4,16}$/;

export function proxy(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("r");
  const response = NextResponse.next();

  if (!code) return response;

  const clean = code.toLowerCase();
  // Reject anything that is not shaped like one of our codes rather than
  // writing arbitrary visitor-supplied text into a cookie.
  if (!VALID.test(clean)) return response;

  // First code wins. Otherwise anyone could overwrite a friend's credit by
  // sending the same person a second link.
  if (request.cookies.get(COOKIE)) return response;

  response.cookies.set(COOKIE, clean, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });

  return response;
}

export const config = {
  // Pages only. No point running this for static assets or API calls.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
