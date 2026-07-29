import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SectionLabel } from "../../components/SectionLabel";
import { evidenceOf, profileByUsername, standingOf } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { REWARD } from "@/lib/rewards";

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
  const profile = await profileByUsername(decodeURIComponent(username));
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
  const profile = await profileByUsername(decodeURIComponent(username));
  if (!profile) notFound();

  const score = scorePatina(evidenceOf(profile));
  const standing = await standingOf(profile.id, REWARD.places);
  const year = score.oldestSignal ? new Date(score.oldestSignal.date).getFullYear() : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Patina card</SectionLabel>

      {/*
        Layered edges rather than a flat panel, so the card has some physical
        presence. It is the thing people screenshot, so it earns the extra
        weight.
      */}
      <div className="relative mt-6">
        <div
          aria-hidden="true"
          className="absolute inset-x-3 -bottom-2 h-6 rounded-b-2xl border border-line bg-panel-2"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-1.5 -bottom-1 h-6 rounded-b-2xl border border-line bg-panel"
        />

        <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-panel">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-accent/25"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full border border-accent/40"
          />

          <div className="relative p-7 sm:p-10">
            <p className="text-lg text-text-2">{profile.username}</p>

            <div className="mt-2 flex items-end gap-3">
              <span className="t-display text-accent">{score.total}</span>
              <span className="pb-3 text-2xl font-semibold text-text-4">/100</span>
            </div>

            <p className="mt-2 text-2xl font-semibold text-text">{verdict(score)}</p>

            {year !== null && (
              <p className="mt-3 text-lg leading-relaxed text-text-2">
                A digital life traced back to <span className="text-text">{year}</span>, which is{" "}
                <span className="text-text">{Math.floor(score.oldestSignal!.years)} years</span> of
                history nobody could have manufactured.
              </p>
            )}

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
              <div>
                <dt className="t-label text-text-3">Rank</dt>
                <dd className="t-mono mt-1 text-xl text-text">
                  {standing.rank !== null ? `#${standing.rank}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="t-label text-text-3">Sources</dt>
                <dd className="t-mono mt-1 text-xl text-text">{score.sourcesConnected.length}</dd>
              </div>
              <div>
                <dt className="t-label text-text-3">Since</dt>
                <dd className="t-mono mt-1 text-xl text-text">{year ?? "—"}</dd>
              </div>
              <div>
                <dt className="t-label text-text-3">Of</dt>
                <dd className="t-mono mt-1 text-xl text-text">{standing.total}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

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
                <div className="h-full bg-accent" style={{ width: `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` }} />
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
