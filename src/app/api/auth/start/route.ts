import { startAuth } from "@/lib/auth";
import { ensureSessionId, readSessionId } from "@/lib/session";
import { checkConnectRate } from "@/lib/ratelimit";

export async function POST(request: Request) {
  const existing = await readSessionId();
  const rate = await checkConnectRate(request, existing);

  if (!rate.allowed) {
    return Response.json(
      { error: "Too many attempts just now. Try again in a few minutes." },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  // Mint the browser session here so the wallet can be attached to it later.
  await ensureSessionId();

  try {
    return Response.json(await startAuth());
  } catch (error) {
    console.error("[auth/start]", error);
    return Response.json({ error: "Could not start sign-in. Try again." }, { status: 502 });
  }
}
