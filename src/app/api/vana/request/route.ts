import { controllerFor } from "@/lib/vana";
import { isSourceId, scopesFor } from "@/lib/sources";
import { ensureSessionId, readSessionId } from "@/lib/session";
import { ensureProfileId, rememberRequest } from "@/lib/store";
import { checkConnectRate } from "@/lib/ratelimit";
import { altchaConfigured, verifyAltcha } from "@/lib/altcha";
import { siteUrl } from "@/lib/site";
import { countAsync } from "@/lib/metrics";

/**
 * Start one connection: create the access request and hand back the URL that
 * sends the user to Vana.
 *
 * ALL of the source's scopes go in a single request. GitHub asks once for four
 * things rather than four times for one, which takes the whole manifest from
 * twenty-one approval trips to ten. See the note in vana.ts on why that is
 * possible now and was not in v1.
 *
 * No sign-in requirement, and no wallet. The moment of connecting is exactly
 * where people give up, so nothing is asked for here. Identity resolves itself
 * on the way back, when the approval reveals which Personal Server this is
 * (see profileForServer in store.ts).
 */
export async function POST(request: Request) {
  const source = new URL(request.url).searchParams.get("source");

  if (!isSourceId(source)) {
    return Response.json({ error: "Unknown source" }, { status: 400 });
  }

  // Rate limit BEFORE minting a session, so hammering this route cannot spin up
  // unlimited sessions to escape the per-session bucket.
  const existingSession = await readSessionId();
  const rate = await checkConnectRate(request, existingSession);

  if (!rate.allowed) {
    return Response.json(
      { error: "That is a lot of connections in a short time. Try again a little later." },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  /**
   * Invisible bot check. Each paid connection must carry a freshly solved
   * proof-of-work, so a script cannot spend the escrow in a loop. The browser
   * solves this without any interaction; a caller that cannot present a valid
   * solution is not a person. Skipped entirely when ALTCHA is not configured,
   * so the flow keeps working before the key is added.
   */
  if (altchaConfigured()) {
    const solved = await verifyAltcha(request.headers.get("x-altcha") ?? "");
    if (!solved) {
      return Response.json(
        { error: "Could not verify your browser. Refresh the page and try again." },
        { status: 403 },
      );
    }
  }

  const sessionId = await ensureSessionId();
  const profileId = await ensureProfileId(sessionId);

  /**
   * Vana sends the user straight back to the connect page, where the pending
   * request is picked up and finished off. A dedicated "you may close this tab"
   * page only makes sense for a popup flow, and this is a redirect.
   *
   * siteUrl, not the raw env var: unset, that interpolated to the literal string
   * "undefined/connect" and dropped every approved user on a dead page.
   */
  const accessRequest = await controllerFor(source).createAccessRequest({
    returnUrl: siteUrl("/connect"),
  });

  // Counted here rather than at the button, because a click that never becomes
  // a request is not a start, and counting it would flatter the funnel at
  // exactly the point being measured.
  countAsync("connect_started", source);

  await rememberRequest(accessRequest.requestId, {
    source,
    profileId,
    createdAt: new Date().toISOString(),
  });

  return Response.json({
    ...accessRequest,
    source,
    scopes: scopesFor(source),
  });
}
