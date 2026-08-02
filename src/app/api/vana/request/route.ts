import { controllerFor, isSourceId } from "@/lib/vana";
import { ensureSessionId, readSessionId } from "@/lib/session";
import { rememberRequest, resolveProfileId } from "@/lib/store";
import { checkConnectRate } from "@/lib/ratelimit";
import { siteUrl } from "@/lib/site";

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

  // No sign-in requirement.
  //
  // There was one, gating this route behind a Vana wallet address. It had to go:
  // that address is only obtainable through the Context Gateway, ODL's separate
  // commercial layer, which needs a client_id we do not have. account.vana.org
  // answers the SDK's own auth URL with "This app is not registered with Vana".
  //
  // So the gate blocked every connection on the site while offering a sign-in
  // that could never complete. Identity is solved separately and optionally,
  // with Google sign-in folding this browser into one cross-device profile
  // (see claimProfile) — connecting itself never requires it.
  const profileId = await resolveProfileId(browserSession);

  // Vana sends the user straight back to the connect page, where the pending
  // request is picked up from sessionStorage and finished off. A dedicated
  // "you may close this tab" page only makes sense for the popup flow, and we
  // do not use one because popups break on phones.
  const accessRequest = await controllerFor(source).createAccessRequest({
    // siteUrl, not the raw env var: unset, this interpolated to the literal
    // string "undefined/connect" and dropped every approved user on a dead page.
    returnUrl: siteUrl("/connect"),
  });

  await rememberRequest(accessRequest.requestId, {
    source,
    profileId,
    createdAt: new Date().toISOString(),
  });

  return Response.json({ ...accessRequest, source });
}
