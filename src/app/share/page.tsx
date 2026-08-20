import Link from "next/link";
import { ShareCard } from "../connect/ShareCard";
import { SignInGate } from "../connect/SignInGate";
import { readSessionId } from "@/lib/session";
import {
  evidenceOf,
  getProfile,
  leaguePoints,
  referralTally,
  resolveProfileId,
  standingOf,
} from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { googleConfigured } from "@/lib/google";

export const metadata = {
  title: "Share",
  description: "Share your Patina card and climb the leaderboard.",
};

export const dynamic = "force-dynamic";

/**
 * Mobile-only share surface.
 *
 * On phones the share panel used to sit under five source cards on /connect, 
 * past the fold, past the score, past the story button. So almost nobody
 * reached it. This page is one job: share. Desktop keeps sharing on Connect
 * and is bounced there so we do not maintain two competing layouts.
 */
export default async function SharePage() {
  const sessionId = await readSessionId();
  const profileId = sessionId ? await resolveProfileId(sessionId) : null;
  const profile = profileId ? await getProfile(profileId) : null;
  const signedIn = Boolean(profile?.id.startsWith("g:"));

  if (!signedIn) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-12 sm:px-6">
        <div className="mb-8 sm:hidden">
          <h1 className="t-section text-text">Share your card</h1>
          <p className="mt-3 text-base leading-relaxed text-text-2">
            Sign in first so your score and invite link follow you.
          </p>
        </div>
        <SignInGate loginAvailable={googleConfigured()} loginError={null} />
      </main>
    );
  }

  const score = scorePatina(evidenceOf(profile!));
  const connected = Object.keys(profile!.sources).length > 0;
  const [tally, standing] = await Promise.all([
    referralTally(profile!.referralCode),
    standingOf(profile!.id, 50),
  ]);

  if (!connected) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-12 sm:px-6">
        <h1 className="t-section text-text">Share your card</h1>
        <p className="mt-4 text-lg leading-relaxed text-text-2">
          Connect at least one account first. There is nothing to share until you have a score.
        </p>
        <Link href="/connect" className="btn btn-primary mt-8 inline-block w-full px-6 py-3.5 text-base">
          Connect an account
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10 sm:px-6 sm:py-14">
      {/* Desktop: sharing lives on Connect. Send them there. */}
      <div className="hidden sm:block">
        <h1 className="t-section text-text">Share lives on Connect</h1>
        <p className="mt-4 text-lg leading-relaxed text-text-2">
          On a bigger screen the share panel sits next to your score. This page is built for phones.
        </p>
        <Link href="/connect" className="btn btn-primary mt-8 inline-block px-6 py-3.5 text-base">
          Go to Connect
        </Link>
      </div>

      <div className="sm:hidden">
        <h1 className="t-section text-text">Share your card</h1>
        <p className="mt-3 text-base leading-relaxed text-text-2">
          Send it to someone real. Every person who connects adds points toward the top 50.
        </p>

        <div className="mt-6">
          <ShareCard
            score={{
              total: score.total,
              verdict: verdict(score),
              components: score.components,
              oldestSignal: score.oldestSignal,
              sourcesConnected: score.sourcesConnected,
            }}
            referralCode={profile!.referralCode}
            referralCount={tally.qualified}
            username={profile!.username ?? null}
            points={leaguePoints(profile!.score, profile!.referrals ?? 0)}
            rank={standing.rank}
          />
        </div>

        {profile!.username && (
          <Link
            href={`/u/${encodeURIComponent(profile!.username)}/story`}
            className="btn btn-ghost mt-4 flex w-full px-6 py-3.5 text-base"
          >
            See your whole story
          </Link>
        )}
      </div>
    </main>
  );
}
