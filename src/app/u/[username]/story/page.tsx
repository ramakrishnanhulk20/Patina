import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { evidenceOf, profileByUsername } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { buildStory } from "@/lib/story";
import { StoryView } from "./StoryView";

export const dynamic = "force-dynamic";

/**
 * A person's digital life, told as a story.
 *
 * Same data class as the card. Dates, counts, years, never the account handles
 * behind them. So a shared story exposes nothing the shared card would not. It
 * is the payoff for connecting: the score says how much, this says what.
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

  const title = `${profile.username}'s digital life, traced`;
  const description = year
    ? `A story that begins in ${year}. Anyone can make a new account. Nobody can make an old one.`
    : "Anyone can make a new account. Nobody can make an old one.";

  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await profileByUsername(decodeURIComponent(username));
  if (!profile) notFound();

  const evidence = evidenceOf(profile);
  const score = scorePatina(evidence);
  const story = buildStory(evidence, score, verdict(score));

  return <StoryView username={profile.username ?? "anonymous"} story={story} />;
}
