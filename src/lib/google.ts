/**
 * Sign in with Google.
 *
 * Written directly rather than pulled from a library, because all that is
 * needed is the authorization-code flow and the whole thing is small enough to
 * read in one sitting. What it buys us is the one thing Vana would not give us
 * for free: a STABLE identity. Google's `sub` is the same string on a phone, a
 * laptop and a borrowed computer, so one person is one profile and one row in
 * the standings.
 *
 * Deliberately minimal scope: `openid`. We do not ask for an email, a name, a
 * picture, contacts, or anything else. All we need is Google's stable per-user
 * `sub` to tell people apart across devices — an app whose pitch is "your data
 * stays yours" has no business collecting more than that.
 */

import { siteUrl } from "./site";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  return siteUrl("/api/login/callback");
}

/** Unguessable value tying a callback back to the browser that started it. */
export function newState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid",
    state,
    // Always show the picker: people share devices, and silently reusing a
    // signed-in Google account is how somebody ends up on a stranger's profile.
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleIdentity = {
  /** Google's stable per-user id. The identity we key profiles on. */
  sub: string;
  email?: string;
};

/**
 * Swap the one-time code for an id token and read the identity out of it.
 *
 * The token's signature is not re-verified, which is correct here and not a
 * shortcut: it was fetched over TLS directly from Google's token endpoint, in a
 * server-to-server call, using our client secret. Google's own documentation
 * calls this out as the case where signature validation can be skipped. It
 * would be required if the token had arrived from a browser.
 */
export async function exchangeCode(code: string): Promise<GoogleIdentity | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    console.error("[google] token exchange failed", response.status, await response.text());
    return null;
  }

  const body = (await response.json()) as { id_token?: string };
  return body.id_token ? readIdToken(body.id_token) : null;
}

/** Decode the JWT payload. Exported so the parsing is testable on its own. */
export function readIdToken(idToken: string): GoogleIdentity | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { sub?: unknown; email?: unknown; aud?: unknown; exp?: unknown };

    if (typeof payload.sub !== "string" || !payload.sub) return null;

    // Belt and braces even on a server-to-server token: a token minted for a
    // different client, or an expired one, is not ours to trust.
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) return null;
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;

    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

/** Profile ids for Google accounts, namespaced so they cannot collide with cookie ids. */
export function googleProfileId(sub: string): string {
  return `g:${sub}`;
}
