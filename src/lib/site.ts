/**
 * Where this deployment lives, in one place.
 *
 * Four separate files were deriving this from `VANA_APP_URL` with four
 * different fallbacks — and `/api/vana/request` had none at all, so a missing
 * variable produced the literal return URL `"undefined/connect"` and sent every
 * user who approved a source to a broken page. A single source with one
 * fallback is the whole point of this file.
 *
 * The fallback is the live domain rather than localhost on purpose: a preview
 * deploy that forgets the variable should still produce shareable links and a
 * working return URL, not ones pointing at somebody's laptop.
 *
 * Note this value is baked into the Vana app identity registration, so changing
 * the domain means re-registering the app.
 */
const FALLBACK = "https://patinadata.xyz";

/** No trailing slash, so callers can always just append a path. */
export const SITE_URL = (process.env.VANA_APP_URL ?? FALLBACK).replace(/\/+$/, "");

/** An absolute URL for a path on this deployment. */
export function siteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
