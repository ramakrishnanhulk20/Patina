import { pollAuth } from "@/lib/auth";
import { readSessionId } from "@/lib/session";
import { linkSessionToWallet } from "@/lib/store";
import { scorePatina } from "@/lib/score";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return Response.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const browserSession = await readSessionId();
  if (!browserSession) {
    return Response.json({ error: "No session. Start again." }, { status: 400 });
  }

  let result;
  try {
    result = await pollAuth(sessionId);
  } catch (error) {
    console.error("[auth/status]", error);
    return Response.json({ error: "Could not check sign-in." }, { status: 502 });
  }

  if (result.status !== "approved") {
    return Response.json(result);
  }

  // Signed in. Move this browser onto the wallet's profile, folding in whatever
  // it had already collected anonymously so nobody loses a score they earned
  // before signing in.
  const profile = await linkSessionToWallet(browserSession, result.address, (evidence) =>
    scorePatina(evidence).total,
  );

  return Response.json({
    status: "approved",
    // Truncated: enough for someone to recognise their own account, not enough
    // to be a useful handle for anyone else.
    address: `${result.address.slice(0, 6)}…${result.address.slice(-4)}`,
    sourcesConnected: Object.keys(profile.sources).length,
  });
}
