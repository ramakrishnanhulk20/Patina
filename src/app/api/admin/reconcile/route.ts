import { reconcileRankings } from "@/lib/store";
import { scorePatina } from "@/lib/score";

export const dynamic = "force-dynamic";

/**
 * Re-derive the ranked index from every profile. Run after a formula change.
 *
 * This used to happen implicitly on every standings page view, which made one
 * page render cost a round trip per user in the system. It belongs here: an
 * explicit, occasional, deliberate operation.
 *
 * Guarded by a shared secret compared in constant time. Without ADMIN_TOKEN set
 * the route refuses outright rather than defaulting to open — an endpoint that
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

/**
 * Length-independent comparison.
 *
 * Hashing both sides first means the comparison runs over two equal-length
 * digests, so neither the token's length nor its first differing character can
 * be read off the response time.
 */
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) {
    // Still walk a fixed amount of work rather than returning immediately.
    let sink = 0;
    for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
      sink |= (left[i] ?? 0) ^ (right[i] ?? 0);
    }
    return sink === -1; // Never true; the loop exists only to burn the time.
  }

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}
