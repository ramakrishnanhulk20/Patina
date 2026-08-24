import { ConnectFlow } from "./ConnectFlow";
import { ecosystemApps } from "@/lib/ecosystem";
import { CORE_ORDER, SOURCE_SPECS, STRENGTHEN_ORDER } from "@/lib/sources";
import { readSessionId } from "@/lib/session";
import { evidenceOf, getProfile, resolveProfileId } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";

export const metadata = { title: "Connect" };
export const dynamic = "force-dynamic";

/**
 * Sources are offered in two tiers.
 *
 * The four core ones carry nearly all the Continuity and Vouch signal between
 * them, and the first run should be one source, one score, one visible jump.
 * The other six live behind "strengthen this", because the Vana Desktop import
 * is where people drop off and it is far easier to survive the second time,
 * once somebody has already seen a number they care about.
 */
export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionId = await readSessionId();
  const profileId = sessionId ? await resolveProfileId(sessionId) : null;
  const profile = profileId ? await getProfile(profileId) : null;
  const score = scorePatina(profile ? evidenceOf(profile) : {});

  const connected = Object.fromEntries(
    Object.entries(profile?.sources ?? {}).map(([source, record]) => [
      source,
      { readAt: record!.readAt, scopes: record!.scopes.length },
    ]),
  );

  /**
   * Fetched unconditionally and handed to the client so the onward-apps panel
   * can appear the instant the first source lands, rather than only after a
   * full page reload re-ran this server component. Rendered by ConnectFlow only
   * once something is connected, so a first-time visitor never sees it: it
   * stays the payoff, not an advert. Empty when the ecosystem API is down.
   */
  const nextApps = await ecosystemApps(4);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-14">
      <ConnectFlow
        core={CORE_ORDER.map((id) => SOURCE_SPECS[id])}
        strengthen={STRENGTHEN_ORDER.map((id) => SOURCE_SPECS[id])}
        initialScore={{
          total: score.total,
          verdict: verdict(score),
          components: score.components,
          oldestSignal: score.oldestSignal,
          sourcesConnected: score.sourcesConnected,
          provisional: score.provisional,
          provisionalReason: score.provisionalReason,
        }}
        initialConnected={connected}
        initialUsername={profile?.username ?? null}
        promptForName={params.name === "1"}
        nextApps={nextApps}
      />
    </main>
  );
}
