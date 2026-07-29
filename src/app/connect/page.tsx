import { ConnectFlow } from "./ConnectFlow";
import { SignInGate } from "./SignInGate";
import { NextApps } from "./NextApps";
import { ecosystemApps } from "@/lib/ecosystem";
import { SOURCE_ORDER, SOURCE_SPECS } from "@/lib/sources";
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

  // Only worth fetching once they have something to spend. Before that it is an
  // advert; after, it is the payoff for having done the setup.
  const connected = Object.keys(profile?.sources ?? {}).length > 0;
  const nextApps = connected ? await ecosystemApps(4) : [];

  const sources = SOURCE_ORDER.map((id) => SOURCE_SPECS[id]);

  const signedIn = Boolean(profile?.id.startsWith("g:"));
  const loginError =
    params.login === "failed"
      ? "That sign-in did not complete. Try again, and if it keeps failing tell us."
      : params.login === "unavailable"
        ? "Sign-in is not switched on yet."
        : null;

  if (!signedIn) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 sm:py-20">
        <SignInGate loginAvailable={googleConfigured()} loginError={loginError} />
      </main>
    );
  }

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
        initialSignedIn={Boolean(profile?.id.startsWith("g:"))}
        initialUsername={profile?.username ?? null}
      />

      <NextApps apps={nextApps} />
    </main>
  );
}
