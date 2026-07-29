import Link from "next/link";
import { ConnectFlow } from "./ConnectFlow";
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

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-14">
      <nav className="mb-12 flex items-center justify-between">
        <Link href="/" className="tap t-label flex items-center gap-2.5 text-text">
          <span className="rings" aria-hidden="true" />
          Patina
        </Link>
        <Link href="/#reward" className="tap t-label text-text-3 transition hover:text-text">
          The reward
        </Link>
      </nav>

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
        loginAvailable={googleConfigured()}
        promptForName={params.name === "1"}
      />

      <NextApps apps={nextApps} />
    </main>
  );
}
