import { ConnectFlow } from "./ConnectFlow";
import { ecosystemApps } from "@/lib/ecosystem";
import { DESKTOP_ORDER, SOURCE_ORDER, SOURCE_SPECS } from "@/lib/sources";
import { readSessionId } from "@/lib/session";
import { evidenceOf, getProfile, referralTally, resolveProfileId } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { googleConfigured } from "@/lib/google";
export const metadata = { title: "Connect" };
export const dynamic = "force-dynamic";

/** Ordered by how likely someone is to have one, and how much age it proves. */

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionId = await readSessionId();
  // Resolved to the wallet profile when signed in, so the page shows one score
  // across every device rather than whatever this browser happens to hold.
  const profileId = sessionId ? await resolveProfileId(sessionId) : null;
  const profile = profileId ? await getProfile(profileId) : null;
  const score = scorePatina(profile ? evidenceOf(profile) : {});

  const readAt = Object.fromEntries(
    Object.entries(profile?.sources ?? {}).map(([source, record]) => [source, record.readAt]),
  );

  // A profile only exists once something has been connected, so a first-time
  // visitor legitimately has no referral code yet. The share panel appears with
  // the first source.
  const tally = profile ? await referralTally(profile.referralCode) : { qualified: 0 };

  // Fetched unconditionally now, and handed to the client so the "counts
  // double" panel can appear the instant the first source connects rather than
  // only after a reload. It is cached for an hour and rendered by ConnectFlow
  // only once there is a connected source, so a first-time visitor with nothing
  // connected still never sees it: it stays the payoff, not an advert.
  const nextApps = await ecosystemApps(4);

  const sources = [...SOURCE_ORDER, ...DESKTOP_ORDER].map((id) => SOURCE_SPECS[id]);

  const signedIn = Boolean(profile?.id.startsWith("g:"));
  const loginError =
    params.login === "failed"
      ? "That sign-in did not complete. Try again, and if it keeps failing tell us."
      : params.login === "unavailable"
        ? "Sign-in is not switched on yet."
        : null;

  // No hard sign-in gate. A person can connect a source and see their score
  // first, then be asked to sign in to KEEP it. Which converts far better than
  // a Google wall in front of any value. Signing in still folds this browser's
  // profile into a stable identity (claimProfile), so "one person, one row"
  // holds for everyone who signs in.
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-14">
      <ConnectFlow
        sources={sources}
        initialScore={{
          total: score.total,
          verdict: verdict(score),
          components: score.components,
          oldestSignal: score.oldestSignal,
          sourcesConnected: score.sourcesConnected,
        }}
        initialReadAt={readAt}
        referralCode={profile?.referralCode ?? ""}
        referralCount={tally.qualified}
        promptForName={params.name === "1"}
        initialSignedIn={signedIn}
        initialUsername={profile?.username ?? null}
        loginAvailable={googleConfigured()}
        loginError={loginError}
        nextApps={nextApps}
      />
    </main>
  );
}
