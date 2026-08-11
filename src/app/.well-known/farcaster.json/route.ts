import { farcasterManifest } from "@/lib/farcaster";

/**
 * The Farcaster domain manifest.
 *
 * A Farcaster client fetches this to learn the app behind a Mini App embed: its
 * name, icon, splash, and the signed association proving this domain belongs to
 * a Farcaster account. Served from a route rather than a static file so the
 * account association can arrive as env vars without a code change or redeploy.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(farcasterManifest(), {
    headers: { "cache-control": "public, max-age=0, s-maxage=600, stale-while-revalidate=86400" },
  });
}
