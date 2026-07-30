import { NextResponse } from "next/server";
import { WIP_UNLOCK_COOKIE } from "@/lib/wip";

const PASSWORD = "open";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  let body: { password?: string } = {};
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (body.password !== PASSWORD) {
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
