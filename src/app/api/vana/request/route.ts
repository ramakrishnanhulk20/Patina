import { controllerFor, isSourceId } from "@/lib/vana";
import { ensureSessionId, readSessionId } from "@/lib/session";
import { linkedWallet, rememberRequest, resolveProfileId } from "@/lib/store";
import { checkConnectRate } from "@/lib/ratelimit";

export async function POST(request: Request) {
  const source = new URL(request.url).searchParams.get("source");

  if (!isSourceId(source)) {
    return Response.json({ error: "Unknown source" }, { status: 400 });
  }

  // Rate limit before minting a session, so hammering this route cannot spin up
  // unlimited sessions to escape the per-session bucket.
  const existingSession = await readSessionId();
  const rate = await checkConnectRate(request, existingSession);

  if (!rate.allowed) {
    return Response.json(
      { error: "That is a lot of connections in a short time. Try again a little later." },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  // The read must be recorded against the WALLET profile when the person has
  // signed in, not against this browser. Otherwise connecting on a phone and a
  // laptop produces two half-finished profiles for the same human.
  const browserSession = await ensureSessionId();
  const wallet = await linkedWallet(browserSession);

  // Enforced here as well as in the UI. A disabled button is a hint; this is
  // the rule. Without it, a request that skipped the button would spend escrow
  // to build a profile that can never be merged or paid out correctly.
  if (!wallet) {
    return Response.json(
      { error: "Sign in first so your score follows you rather than this browser." },
      { status: 401 },
    );
  }

  const profileId = await resolveProfileId(browserSession);

  // Vana sends the user straight back to the connect page, where the pending
  // request is picked up from sessionStorage and finished off. A dedicated
  // "you may close this tab" page only makes sense for the popup flow, and we
  // do not use one because popups break on phones.
  const accessRequest = await controllerFor(source).createAccessRequest({
    returnUrl: `${process.env.VANA_APP_URL}/connect`,
  });

  await rememberRequest(accessRequest.requestId, {
    source,
    profileId,
    createdAt: new Date().toISOString(),
  });

  return Response.json({ ...accessRequest, source });
}
