import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SectionLabel } from "../../components/SectionLabel";
import { PlateCard } from "../../components/PlateCard";
import { SaveCard } from "./SaveCard";
import { SignedProof } from "./SignedProof";
import { DigitalRings } from "../../components/DigitalRings";
import { evidenceOf, profileForUsername } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { buildAttestation } from "@/lib/attest";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Somebody's public card.
 *
 * The page a shared link lands on. It shows a score and a name and nothing that
 * could identify the accounts behind them: those exist to stop one person
 * counting twice, and publishing them would contradict the entire product.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await profileForUsername(decodeURIComponent(username));
  if (!profile) return { title: "Not found" };

  const score = scorePatina(evidenceOf(profile));
  const year = score.oldestSignal ? new Date(score.oldestSignal.date).getFullYear() : null;

  const title = `${profile.username} scored ${score.total}/100 on Patina`;
  const description = year
    ? `A digital life traced back to ${year}. Anyone can make a new account. Nobody can make an old one.`
    : "Anyone can make a new account. Nobody can make an old one.";

  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await profileForUsername(decodeURIComponent(username));
  if (!profile) notFound();

  const score = scorePatina(evidenceOf(profile));
  /**
   * No rank, and no "top N%", on purpose.
   *
   * This page is public and keyed by a name anybody can guess, so anything
   * positional shown here can be collected one name at a time and reassembled
   * into a ranked list, which Patina deliberately does not publish. Removing the
   * list while leaving each person's place on their own card would have moved
   * the leak rather than closed it.
   *
   * What stays is everything about the person in isolation: their score, how
   * far their history goes back, how many platforms corroborate it, and the
   * signed proof. None of that says anything about anybody else, which is the
   * line this page now holds.
   */
  const year = score.oldestSignal ? new Date(score.oldestSignal.date).getFullYear() : null;
  const years = score.oldestSignal ? Math.floor(score.oldestSignal.years) : null;
  const line = verdict(score);

  // The signed attestation, built for the card page itself so the proof is on
  // the page a skeptic actually lands on, not one link away. Guarded: if the
  // app key is missing the card must still render, just without the proof block,
  // rather than 500 on every shared link.
  const proof = profile.username
    ? await buildAttestation({
        username: profile.username,
        score: score.total,
        verdict: line,
        oldestYear: year,
        sources: score.sourcesConnected.length,
      }).catch(() => null)
    : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Patina card</SectionLabel>

      {/*
        A real heading, which this page went without entirely. The name and the
        score existed only inside the canvas and an sr-only block, so the page
        had nothing for a crawler to title it by and nothing on screen at all if
        WebGL failed to start.
      */}
      <h1 className="sr-only">
        {profile.username} scored {score.total} out of 100 on Patina. {line}.
        {year !== null ? ` A digital life traced back to ${year}.` : ""}
      </h1>

      <div className="mt-6">
        <div className="card-glow">
          <PlateCard
            username={profile.username ?? "anonymous"}
            score={score.total}
            verdict={line}
            year={year}
            years={years}
          />
        </div>
      </div>

      {/*
        Right under the score, full width, primary. Sitting beside Save as a
        ghost link meant almost nobody noticed a story was waiting. This is the
        next thing every visitor should want to tap.
      */}
      <Link
        href={`/u/${encodeURIComponent(profile.username ?? "")}/story`}
        className="btn btn-primary mt-5 flex w-full flex-col gap-0.5 px-6 py-5 text-lg sm:py-6 sm:text-xl"
      >
        <span>See the whole story</span>
        <span className="text-sm font-normal opacity-70 sm:text-base">
          A time machine, built from their history
        </span>
      </Link>

      <div className="mt-3">
        <SaveCard username={profile.username ?? "anonymous"} />
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-x-6 gap-y-4 border border-line bg-panel p-5">
        <div>
          <dt className="t-label text-text-3">Score</dt>
          <dd className="t-mono mt-1 text-xl text-text">{score.total}</dd>
        </div>
        <div>
          <dt className="t-label text-text-3">Sources</dt>
          <dd className="t-mono mt-1 text-xl text-text">{score.sourcesConnected.length}</dd>
        </div>
        <div>
          <dt className="t-label text-text-3">Since</dt>
          <dd className="t-mono mt-1 text-xl text-text">{year ?? <span className="text-text-4">n/a</span>}</dd>
        </div>
      </dl>

      {/* Screenshots lie; a signed attestation does not. Put the proof on the page. */}
      {proof ? (
        <SignedProof
          username={profile.username ?? ""}
          app={proof.app}
          message={proof.message}
          signature={proof.signature}
          issuedAt={proof.issuedAt}
          verifyUrl={siteUrl(`/api/verify/${encodeURIComponent(profile.username ?? "")}`)}
          apiPath={`/api/verify/${encodeURIComponent(profile.username ?? "")}`}
        />
      ) : (
        <p className="mt-4 text-center text-sm text-text-3">
          <Link
            href={`/verify?u=${encodeURIComponent(profile.username ?? "")}`}
            className="tap text-accent underline underline-offset-4"
          >
            Independently verify this score
          </Link>
        </p>
      )}

      {years !== null && years >= 1 && (
        <div className="mt-8 border border-line bg-panel p-8">
          <DigitalRings years={years} oldestYear={year} />
        </div>
      )}

      <div className="mt-12 space-y-3">
        {score.components.map((component) => {
          const pct = component.max === 0 ? 0 : (component.points / component.max) * 100;
          return (
            <div key={component.key} className="border border-line bg-panel p-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-semibold text-text">{component.label}</span>
                <span className="t-mono text-sm text-text-2">
                  {component.points}
                  <span className="text-text-4"> / {component.max}</span>
                </span>
              </div>
              <div className="mt-2.5 h-[3px] w-full bg-line" aria-hidden="true">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 border-t border-line pt-8">
        <h2 className="text-2xl font-semibold tracking-tight text-text">
          How far back does yours go?
        </h2>
        <p className="mt-2 leading-relaxed text-text-2">
          Free, about a minute, and it works on your phone. No download.
        </p>
        <Link href="/connect" className="btn btn-primary mt-6 inline-block px-6 py-3.5 text-base">
          Get your score
        </Link>
      </div>
    </main>
  );
}
