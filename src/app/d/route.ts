import { redirect } from "next/navigation";
import { ensureSessionId } from "@/lib/session";
import { adoptProfile } from "@/lib/store";
import { scorePatina } from "@/lib/score";

/**
 * "This is me, on another device."
 *
 * A route handler rather than part of the connect page, because adopting has to
 * SET a session cookie and Next only permits that in a route handler or a
 * server action. Doing it during a page render throws, which turned a mistyped
 * link into a 500 instead of a shrug.
 *
 * The token never reaches the connect page: this redirects without it, so the
 * secret does not linger in browser history, get caught in a screenshot, or
 * travel in a referrer header.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("k");

  if (token && /^[0-9a-f]{48}$/.test(token)) {
    const session = await ensureSessionId();
    // An unknown token adopts nothing and is not an error. A stale or mistyped
    // link should quietly do nothing rather than accuse anybody of anything.
    await adoptProfile(session, token, (evidence) => scorePatina(evidence).total);
  }

  redirect("/connect");
}
