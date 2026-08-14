import { NextResponse } from "next/server";
import { WIP_UNLOCK_COOKIE } from "@/lib/wip";
import { safeEqual } from "@/lib/safe-equal";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * Unlock the work-in-progress screen.
 *
 * The password used to be the literal string "open", written in this file, in a
 * public MIT-licensed repository. It gated nothing at the time because APP_WIP
 * is false, but a lock whose key is printed on the door is not a lock, and the
 * moment somebody flipped that flag it would have been open to everybody who
 * had read the source.
 *
 * Now it comes from WIP_PASSWORD, and an unset variable refuses outright rather
 * than falling back to a default. That fails closed, which is the correct
 * direction for a gate: the cost of getting it wrong is an admin who has to set
 * an environment variable, rather than a lock screen that quietly lets the
 * whole internet through.
 */
export async function POST(request: Request) {
  const expected = process.env.WIP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  let body: { password?: string } = {};
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (typeof body.password !== "string" || !safeEqual(body.password, expected)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(WIP_UNLOCK_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  return response;
}
