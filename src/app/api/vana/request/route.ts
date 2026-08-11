import { controllerFor, isSourceId } from "@/lib/vana";
import { ensureSessionId, readReferralCode, readSessionId } from "@/lib/session";
import { rememberRequest, resolveProfileId } from "@/lib/store";
import { normalizeReferralCode } from "@/lib/referral";
import { checkConnectRate } from "@/lib/ratelimit";
import { altchaConfigured, verifyAltcha } from "@/lib/altcha";
import { siteUrl } from "@/lib/site";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source");

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

  // Invisible bot check. Each paid connection must carry a freshly solved
  // proof-of-work (see lib/altcha.ts), so a script cannot spend the escrow in a
  // loop. Skipped entirely when ALTCHA is not configured, so the flow keeps
  // working before the key is added. The browser solves this without any
  // interaction; a caller that cannot present a valid solution is not a person.
  if (altchaConfigured()) {
    const solved = await verifyAltcha(request.headers.get("x-altcha") ?? "");
    if (!solved) {
      return Response.json(
        { error: "Could not verify your browser. Refresh the page and try again." },
        { status: 403 },
      );
    }
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
  // (see claimProfile). Connecting itself never requires it.
  const profileId = await resolveProfileId(browserSession);

  // Pin the referral code to the request NOW, at the tap, while it is most
  // reliably in reach. The cookie the proxy parked is authoritative when it is
  // present (the edge already enforced first-code-wins), so prefer it; the
  // client also mirrors the code onto this POST as ?ref= from localStorage, for
  // the in-app browsers that never gave the cookie back. Reading it here instead
  // of at data-collection time is the fix for phones dropping the cookie across
  // the Vana approval round trip: by then it may be gone, but the request
  // remembers who to credit. See referrerFor in the data route.
  const referredBy =
    normalizeReferralCode(await readReferralCode()) ??
    normalizeReferralCode(url.searchParams.get("ref"));

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
    ...(referredBy ? { referredBy } : {}),
  });

  return Response.json({ ...accessRequest, source });
}
