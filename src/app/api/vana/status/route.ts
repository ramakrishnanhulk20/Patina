import { controllerFor, isSourceId } from "@/lib/vana";
import { getRequest, resolveProfileId } from "@/lib/store";
import { readSessionId } from "@/lib/session";

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("requestId");

  if (!requestId) {
    return Response.json({ error: "Missing requestId" }, { status: 400 });
  }

  const pending = await getRequest(requestId);
  if (!pending) {
    return Response.json({ error: "Unknown requestId" }, { status: 404 });
  }

  /**
   * Only the session that started this request may poll it.
   *
   * The sibling `/data` route has always checked this; this one did not, which
   * left the two halves of the same flow guarded differently for no reason.
   * A request id is not a secret we control — it travels through Vana's tab and
   * ends up in a URL — so anyone holding one could watch the progress of
   * somebody else's connection and learn which source they were connecting.
   *
   * Compared against the RESOLVED profile for the same reason as `/data`:
   * signing in mid-flow re-points the browser at the wallet profile, and an
   * in-flight request must not start failing because of it.
   */
  const browserSession = await readSessionId();
  const sessionProfile = browserSession ? await resolveProfileId(browserSession) : null;
  if (sessionProfile !== pending.profileId) {
    return Response.json({ error: "Not your request" }, { status: 403 });
  }

  // A stored source that is no longer a valid id would otherwise index into the
  // controller map with junk. Cheap to rule out, and it cannot happen twice.
  if (!isSourceId(pending.source)) {
    return Response.json({ error: "Unknown source" }, { status: 400 });
  }

  const status = await controllerFor(pending.source).getAccessRequestStatus(requestId);
  return Response.json(status);
}
