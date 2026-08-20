import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_WIP, WIP_UNLOCK_COOKIE } from "@/lib/wip";
import { normalizeReferralCode } from "@/lib/referral";

/**
 * Catches a referral code off any page visit and parks it in a cookie.
 *
 * Someone arriving on patina.app/?r=abc123 might read the landing page, wander
 * to the reward section, and only connect several clicks later. The code has to
 * survive that, so it moves out of the URL and into a cookie on first sight.
 *
 * Also enforces the WIP lock: visitors without the admin unlock cookie are
 * rewritten to /wip. The unlock route sets that cookie after a password check.
 *
 * Note this runs before rendering and must not import app/server stores.
 */

const REF_COOKIE = "patina_ref";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (APP_WIP && !isUnlocked(request) && shouldLockPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/wip";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  // Reject anything that is not shaped like one of our codes rather than
  // writing arbitrary visitor-supplied text into a cookie. The shared validator
  // is the same one the connect route and the client mirror use, so a code
  // accepted here can never be rejected when it is read back.
  const clean = normalizeReferralCode(request.nextUrl.searchParams.get("r"));
  const response = NextResponse.next();

  if (!clean) return response;

  // First code wins. Otherwise anyone could overwrite a friend's credit by
  // sending the same person a second link.
  if (request.cookies.get(REF_COOKIE)) return response;

  response.cookies.set(REF_COOKIE, clean, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });

  return response;
}

function isUnlocked(request: NextRequest): boolean {
  return request.cookies.get(WIP_UNLOCK_COOKIE)?.value === "1";
}

function shouldLockPath(pathname: string): boolean {
  // The landing stays public during the upgrade. It is the one page that still
  // says what Patina is, and sending shared links to a lock screen would make a
  // rebuild look like a shutdown.
  if (pathname === "/") return false;
  if (pathname === "/wip") return false;
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/_next/")) return false;
  if (pathname === "/favicon.ico") return false;
  if (pathname === "/manifest.webmanifest") return false;
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return false;
  return true;
}

export const config = {
  // Pages only. No point running this for static assets or API calls.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
