import { cookies } from "next/headers";
import { readSessionId } from "@/lib/session";
import { deleteProfile, resolveProfileId } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Erase everything Patina holds about the caller, then reset their browser.
 *
 * Only ever touches the profile the caller's own session resolves to, so this
 * cannot delete anybody else. Dropping the session cookie afterwards means the
 * next request starts a fresh, empty session rather than resolving back to the
 * profile that was just removed.
 */
export async function POST() {
  const sessionId = await readSessionId();
  if (!sessionId) return Response.json({ ok: true });

  const profileId = await resolveProfileId(sessionId);
  await deleteProfile(profileId);

  const store = await cookies();
  store.delete("patina_sid");

  return Response.json({ ok: true });
}
