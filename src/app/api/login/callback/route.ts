import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exchangeCode, googleProfileId } from "@/lib/google";
import { ensureSessionId } from "@/lib/session";
import { claimProfile } from "@/lib/store";
import { scorePatina } from "@/lib/score";

export const dynamic = "force-dynamic";

/** Where Google sends people back to. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const store = await cookies();
  const expected = store.get("patina_oauth_state")?.value;
  store.delete("patina_oauth_state");

  // They pressed cancel on Google's screen. Not an error worth shouting about.
  if (error || !code) redirect("/connect");

  // The state cookie is what stops somebody feeding a victim's browser a code
  // of their choosing and landing them in an account they do not own.
  if (!state || !expected || state !== expected) {
    redirect("/connect?login=failed");
  }

  const identity = await exchangeCode(code);
  if (!identity) redirect("/connect?login=failed");

  const session = await ensureSessionId();
  const profile = await claimProfile(
    session,
    googleProfileId(identity.sub),
    (evidence) => scorePatina(evidence).total,
  );

  // Straight to picking a name if they have not got one yet, since a leaderboard
  // full of anonymous rows is the thing this is meant to fix.
  redirect(profile.username ? "/connect" : "/connect?name=1");
}
