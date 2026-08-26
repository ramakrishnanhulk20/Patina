import { cookies } from "next/headers";
import { readSessionId } from "@/lib/session";
import { deleteProfile, resolveProfileId, unlinkSession } from "@/lib/store";
import { countAsync } from "@/lib/metrics";

export const dynamic = "force-dynamic";

/**
 * Erase everything Patina holds about the caller, then reset their browser.
 *
 * Only ever touches the profile the caller's own session resolves to, so this
 * cannot delete anybody else. The session link is dropped along with the
 * profile, and then the cookie itself, so nothing is left pointing at a profile
 * that no longer exists.
 */
export async function POST() {
  const sessionId = await readSessionId();
  if (!sessionId) return Response.json({ ok: true });

  const profileId = await resolveProfileId(sessionId);
  if (profileId) {
    await deleteProfile(profileId);
    countAsync("profile_deleted");
  }

  // Dropped even when there was no profile, so a stale link can never outlive
  // the thing it referred to.
  await unlinkSession(sessionId);

  const store = await cookies();
  store.delete("patina_sid");

  return Response.json({ ok: true });
}
