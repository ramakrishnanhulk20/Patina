import { isAdmin } from "@/lib/admin";
import { snapshotWinners, winnersSnapshot } from "@/lib/store";
import { scorePatina } from "@/lib/score";
import { REWARD } from "@/lib/rewards";

export const dynamic = "force-dynamic";

/** The frozen payout list as it stands. */
export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }
  const winners = await winnersSnapshot();
  return Response.json(
    { taken: winners !== null, count: winners?.length ?? 0, winners: winners ?? [] },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Freeze the current top 50 as the payout list.
 *
 * Eligibility was decided at the whistle, but the ranking index keeps moving as
 * people connect, so it has to be captured once and read from thereafter.
 * Running this again overwrites the list, which is why it is a deliberate
 * button rather than something that happens on its own.
 */
export async function POST() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const winners = await snapshotWinners(REWARD.places, (evidence) => scorePatina(evidence).total);
  return Response.json({ ok: true, count: winners.length, winners });
}
