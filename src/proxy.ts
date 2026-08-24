import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_WIP, WIP_UNLOCK_COOKIE } from "@/lib/wip";

/**
 * Enforces the WIP lock: visitors without the admin unlock cookie are rewritten
 * to /wip. The unlock route sets that cookie after a password check.
 *
 * This used to also catch a referral code off any page visit and park it in a
 * cookie, for a competition that has ended. That went with the rest of the
 * contest machinery.
 *
 * Note this runs before rendering and must not import app/server stores.
 */

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (APP_WIP && !isUnlocked(request) && shouldLockPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/wip";
    url.search = "";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
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
