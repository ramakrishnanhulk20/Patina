import { readSessionId } from "@/lib/session";
import { resolveProfileId, setUsername } from "@/lib/store";

export async function POST(request: Request) {
  const sessionId = await readSessionId();
  if (!sessionId) {
    return Response.json({ ok: false, reason: "Connect a source first." }, { status: 400 });
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
  const result = await setUsername(profileId, name);

  // A taken name is not a server error: it is a normal thing to type.
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
