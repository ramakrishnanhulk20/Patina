import { isAdmin } from "@/lib/admin";
import { backfillProfileIndex, stats } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Repair the user count when profiles exist that the index never learned about.
 *
 * WHY THIS IS A REAL PROBLEM AND NOT HOUSEKEEPING. Profiles used to be written
 * with nothing tying them together, because the index that once did that went
 * out with the leaderboard. Counting was added later, and it only ever saw
 * people who arrived after it existed. Everybody who connected in between is
 * invisible: their profile works perfectly, their score is fine, and they are
 * simply not in the number anybody quotes.
 *
 * The repair itself was already written, sitting in the store with no caller.
 * It is a one-time job and does not belong on a schedule, but it does need to
 * be runnable by the person who notices the count looks low, which until now
 * meant a database console.
 *
 * Uses SCAN rather than KEYS, so it does not block Redis for the length of the
 * pass. Adding to a set is idempotent, so running it twice is harmless.
 */
export async function POST() {
  // 404, not 401. A deployment with no admin password should not admit that
  // this endpoint exists at all.
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });

  const result = await backfillProfileIndex();

  // Recomputed rather than read from cache: the whole point of running this is
  // that the cached number was wrong.
  const after = await stats({ fresh: true });

  return Response.json({
    ok: true,
    found: result.found,
    added: result.added,
    profilesNow: after.profiles,
    connectedNow: after.connected,
  });
}
