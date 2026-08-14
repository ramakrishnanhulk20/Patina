import { reconcileRankings } from "@/lib/store";
import { scorePatina } from "@/lib/score";
import { safeEqual } from "@/lib/safe-equal";

export const dynamic = "force-dynamic";

/**
 * Re-derive the ranked index from every profile. Run after a formula change.
 *
 * This used to happen implicitly on every standings page view, which made one
 * page render cost a round trip per user in the system. It belongs here: an
 * explicit, occasional, deliberate operation.
 *
 * Guarded by a shared secret compared in constant time. Without ADMIN_TOKEN set
 * the route refuses outright rather than defaulting to open. An endpoint that
 * rewrites every profile in the system must fail closed.
 */
export async function POST(request: Request) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return Response.json({ error: "Not configured" }, { status: 404 });
  }

  const offered = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(offered, expected)) {
    return Response.json({ error: "No" }, { status: 401 });
  }

  const started = Date.now();
  const fixed = await reconcileRankings((evidence) => scorePatina(evidence).total);

  return Response.json({ ok: true, fixed, ms: Date.now() - started });
}
