import { controllerFor } from "@/lib/vana";
import { getRequest } from "@/lib/store";

export async function GET(request: Request) {
  const requestId = new URL(request.url).searchParams.get("requestId");

  if (!requestId) {
    return Response.json({ error: "Missing requestId" }, { status: 400 });
  }

  const pending = await getRequest(requestId);
  if (!pending) {
    return Response.json({ error: "Unknown requestId" }, { status: 404 });
  }

  const status = await controllerFor(pending.source).getAccessRequestStatus(requestId);
  return Response.json(status);
}
