import type { NextConfig } from "next";

/**
 * Baseline security headers, applied to every response.
 *
 * Deliberately NOT a full Content-Security-Policy: a strict CSP has to be
 * fitted to the app's inline styles, next/font and the WebGL canvas, and a
 * wrong one white-screens the page — that belongs in its own tested change.
 * These are the headers that harden the app without any risk of breaking it:
 * no clickjacking, no MIME sniffing, no referrer leakage, HTTPS pinned. The
 * public verify/badge routes set their own permissive CORS on top; none of
 * these touch that.
 */
const SECURITY_HEADERS = [
  // The app is never meant to be embedded in a frame — this blocks clickjacking
  // of the connect and sign-in flows. (The badge is consumed as an <img>, which
  // this does not affect.)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Two years, subdomains included. Ignored on http/localhost, so dev is fine.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // The app asks for none of these, so deny them outright.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  /**
   * Let the verification build use its own output directory.
   *
   * `npm run verify` already set `NEXT_DIST_DIR=.next-verify`, but that is not
   * a variable Next reads — `distDir` is config-only. So the verification build
   * wrote into `.next` underneath a running dev server, corrupting its
   * Turbopack cache and taking the dev server down with it: exactly the failure
   * the script was written to avoid, silently doing the opposite of what its
   * own comment claimed.
   *
   * Reading it here is what makes that flag real.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
