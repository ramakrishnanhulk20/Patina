import Link from "next/link";
import { readSessionId } from "@/lib/session";
import { getProfile, resolveProfileId, evidenceOf } from "@/lib/store";
import { scorePatina, verdict } from "@/lib/score";
import { SOURCE_SPECS } from "@/lib/sources";
import { SectionLabel } from "../components/SectionLabel";
import { MyData } from "./MyData";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your data",
  description: "Everything Patina holds about you, and how to take any of it back.",
};

/**
 * The page that makes the privacy promise checkable.
 *
 * Patina could delete everything and could do nothing else. You could not see
 * what was stored, could not take a copy, and could not remove one source
 * without destroying the rest. Two of those are legal requirements in the UK
 * and EU rather than niceties, and all three are strange gaps in a product
 * whose argument is that it holds almost nothing.
 *
 * The export is the most persuasive thing here, and it is persuasive precisely
 * because of how short it is. Anybody who suspects Patina keeps more than it
 * says can download the file and search it for a caption, an address or a
 * friend's name, and not find one.
 */
export default async function MyDataPage() {
  const sessionId = await readSessionId();
  const profileId = sessionId ? await resolveProfileId(sessionId) : null;
  const profile = profileId ? await getProfile(profileId) : null;

  if (!profile || Object.keys(profile.sources ?? {}).length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <SectionLabel>Your data</SectionLabel>
        <h1 className="t-section mt-5 text-text">There is nothing here yet.</h1>
        <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-text-2">
          Patina holds nothing about this browser. Once you connect a source, everything it keeps
          will be listed on this page, and you will be able to download it or remove any part of it
          from here.
        </p>
        <Link href="/connect" className="btn btn-primary mt-8 inline-block px-6 py-3.5 text-base">
          Get your score
        </Link>
      </main>
    );
  }

  const score = scorePatina(evidenceOf(profile));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <SectionLabel>Your data</SectionLabel>
      <h1 className="t-section mt-5 text-text">Everything Patina holds about you.</h1>
      <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-text-2">
        All of it, not a summary. Take a copy whenever you like, remove any single source without
        losing the others, or erase the lot.
      </p>

      <MyData
        initial={{
          username: profile.username ?? null,
          createdAt: profile.createdAt,
          anchored: Boolean(profile.serverHash),
          score: { total: score.total, verdict: verdict(score), provisional: score.provisional },
          sources: Object.entries(profile.sources ?? {}).map(([id, record]) => ({
            id,
            label: SOURCE_SPECS[id as keyof typeof SOURCE_SPECS]?.label ?? id,
            connectedAt: record!.readAt,
            scopeCount: record!.scopes.length,
            ownershipProven: record!.proven === true,
            retired: !(id in SOURCE_SPECS),
          })),
        }}
      />
    </main>
  );
}
