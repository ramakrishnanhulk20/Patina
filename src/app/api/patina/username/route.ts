import { readSessionId } from "@/lib/session";
import { claimUsername, getProfile, resolveProfileId } from "@/lib/store";
import { checkUsernameRate } from "@/lib/ratelimit";
import { countAsync } from "@/lib/metrics";

export async function POST(request: Request) {
  const sessionId = await readSessionId();
  if (!sessionId) {
    return Response.json({ ok: false, reason: "Connect a source first." }, { status: 400 });
  }

  const rate = await checkUsernameRate(request, sessionId);
  if (!rate.allowed) {
    return Response.json(
      { ok: false, reason: "Too many tries just now. Give it a minute." },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  let name: unknown;
  try {
    name = (await request.json())?.username;
  } catch {
    return Response.json({ ok: false, reason: "Bad request." }, { status: 400 });
  }

  if (typeof name !== "string") {
    return Response.json({ ok: false, reason: "Pick a name." }, { status: 400 });
  }

  const profileId = await resolveProfileId(sessionId);
  if (!profileId) {
    return Response.json({ ok: false, reason: "Connect a source first." }, { status: 400 });
  }

  const hadName = Boolean((await getProfile(profileId))?.username);
  const result = await claimUsername(profileId, name);
  // Only a first claim counts. A rename is the same person, and counting it
  // would make the number drift upwards on its own.
  if (result.ok && !hadName) countAsync("name_claimed");

  // A taken name is not a server error: it is a normal thing to type.
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
