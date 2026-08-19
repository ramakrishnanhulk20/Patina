import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, adminCookieValue, passwordMatches } from "@/lib/admin";
import { checkUsernameRate } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const TWELVE_HOURS = 60 * 60 * 12;

/**
 * Exchange the admin password for a session cookie.
 *
 * Rate limited on the same bucket shape as everything else, because an
 * unmetered password endpoint is a free brute-force oracle. Twelve hours is a
 * deliberately short session: the page lists real users and payout addresses,
 * so a forgotten laptop should stop being an admin console the same day.
 */
export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ ok: false, reason: "Not configured" }, { status: 404 });
  }

  const rate = await checkUsernameRate(request, null);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, reason: "Too many attempts. Wait a while." },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  let password: unknown;
  try {
    password = (await request.json())?.password;
  } catch {
    return NextResponse.json({ ok: false, reason: "Bad request" }, { status: 400 });
  }

  if (typeof password !== "string" || !passwordMatches(password)) {
    return NextResponse.json({ ok: false, reason: "Wrong password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, adminCookieValue()!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TWELVE_HOURS,
  });
  return response;
}

/** Sign out. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
