import { adminConfigured, isAdmin, signIn, signOut } from "@/lib/admin";
import { checkUsernameRate } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/**
 * Start or end an admin session.
 *
 * 404 rather than 401 when no password is configured, so a deployment that
 * never set one does not advertise that an admin surface exists. Rate limited
 * on the same bucket the username route uses: this is the one endpoint on the
 * site where guessing repeatedly is worth an attacker's time, and sixty
 * attempts an hour makes a password of any length unguessable while never
 * getting in the way of somebody who mistyped theirs.
 */
export async function POST(request: Request) {
  if (!adminConfigured()) return new Response("Not found", { status: 404 });

  const rate = await checkUsernameRate(request, null);
  if (!rate.allowed) {
    return Response.json(
      { ok: false },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  let password: unknown;
  try {
    password = (await request.json())?.password;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (typeof password !== "string" || !(await signIn(password))) {
    // No detail, deliberately. "Wrong password" and "no password set" are the
    // same answer here, because the difference is only useful to somebody who
    // should not be asking.
    return Response.json({ ok: false }, { status: 401 });
  }

  return Response.json({ ok: true });
}

export async function DELETE() {
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });
  await signOut();
  return Response.json({ ok: true });
}
