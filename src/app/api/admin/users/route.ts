import { isAdmin } from "@/lib/admin";
import {
  evidenceOf,
  getProfile,
  leaguePoints,
  scoredProfileCount,
  topProfiles,
  winnersSnapshot,
} from "@/lib/store";
import { scorePatina } from "@/lib/score";

export const dynamic = "force-dynamic";

/**
 * Every scoring profile, for the admin console.
 *
 * Returns the fields needed to decide and settle a payout and nothing else. The
 * connected account ids (the real YouTube channel, the GitHub username) are
 * deliberately NOT included: they are the most sensitive thing Patina holds,
 * they are not needed to work out who gets paid, and an admin page that leaks
 * them through its own API is the same class of mistake as the standings page
 * that leaked profile ids.
 *
 * Admin-gated and never cached.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const total = await scoredProfileCount();
  const ranked = await topProfiles(Math.max(total, 1));
  const profiles = await Promise.all(ranked.map((row) => getProfile(row.id)));
  const frozen = await winnersSnapshot();
  const frozenRank = new Map((frozen ?? []).map((w) => [w.id, w.rank]));

  const rows = ranked
    .map((row, index) => {
      const profile = profiles[index];
      if (!profile) return null;

      const score = scorePatina(evidenceOf(profile));
      const referrals = profile.referrals ?? 0;

      return {
        id: profile.id,
        liveRank: index + 1,
        frozenRank: frozenRank.get(profile.id) ?? null,
        username: profile.username ?? null,
        points: leaguePoints(score.total, referrals),
        score: score.total,
        referrals,
        sources: Object.keys(profile.sources ?? {}).length,
        referralCode: profile.referralCode,
        payoutAddress: profile.payoutAddress ?? null,
        signedIn: profile.id.startsWith("g:"),
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.points - a.points || b.score - a.score);

  return Response.json(
    {
      total,
      snapshotTaken: frozen !== null,
      snapshotSize: frozen?.length ?? 0,
      claimed: rows.filter((r) => r.payoutAddress).length,
      rows,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
