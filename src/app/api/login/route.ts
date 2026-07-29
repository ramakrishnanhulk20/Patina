import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authUrl, googleConfigured, newState } from "@/lib/google";
import { ensureSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Start Google sign-in.
 *
 * A plain GET so it can be a normal link. No popup, no second tab: this is a
 * full-page redirect out and back, which is the flow every phone user already
 * knows and the one least likely to be blocked or suspended.
 */
export async function GET() {
  if (!googleConfigured()) {
    redirect("/connect?login=unavailable");
  }

  // Mint the browser session first, so whatever this person has already
  // collected anonymously can be folded in when they come back.
  await ensureSessionId();

  const state = newState();
  const store = await cookies();

  store.set("patina_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  redirect(authUrl(state));
}
