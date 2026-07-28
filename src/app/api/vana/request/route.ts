import { controllerFor, isSourceId } from "@/lib/vana";
import { ensureSessionId } from "@/lib/session";
import { rememberRequest } from "@/lib/store";

export async function POST(request: Request) {
  const source = new URL(request.url).searchParams.get("source");

  if (!isSourceId(source)) {
    return Response.json({ error: "Unknown source" }, { status: 400 });
  }

  const profileId = await ensureSessionId();

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
