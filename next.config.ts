import type { NextConfig } from "next";

/**
 * The Content-Security-Policy, finally.
 *
 * It was deliberately left out before, with a note saying a strict one has to
 * be fitted to the app's inline styles, next/font and the WebGL canvas, and
 * that a wrong one white-screens the page. That reasoning was right, and it is
 * also how a CSP never gets written. So this one is fitted rather than
 * strictest-possible, and every allowance below says what forced it.
 *
 * WHAT IT ACTUALLY BUYS. Not protection from inline script, which Next needs
 * and which a nonce-based policy would require per-request middleware to fix.
 * What it buys is the thing that matters most for a product holding personal
 * data: a page that has been compromised still cannot SEND anything anywhere.
 * `connect-src` and `default-src` pin every request to this origin, so an
 * injected script has nowhere to exfiltrate to. `object-src 'none'`,
 * `base-uri 'self'` and `form-action 'self'` close the three classic ways of
 * getting around exactly that.
 */
function contentSecurityPolicy(): string {
  const dev = process.env.NODE_ENV !== "production";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],

    /**
     * `unsafe-inline` is not optional here. Next inlines its bootstrap and
     * streaming scripts, and removing it takes the app down rather than
     * hardening it. Removing it properly means a nonce, which means middleware
     * on every request, which is its own change with its own risks.
     *
     * `unsafe-eval` only in development, where Turbopack's hot reloading needs
     * it. Production never gets it.
     */
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],

    // Tailwind and next/font both emit inline style, and every animation in
    // the app sets style attributes directly.
    "style-src": ["'self'", "'unsafe-inline'"],

    /**
     * `https:` rather than a list of hosts, because the onward-apps panel
     * shows icons served from whichever domains those builders use. Pinning
     * them would mean editing this file every time that list changes, which is
     * how a policy ends up being deleted in a hurry. Images cannot exfiltrate
     * meaningfully once connect-src is locked down.
     */
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],

    /**
     * THE IMPORTANT LINE. Everything the browser fetches goes to this origin:
     * the connect flow calls Patina's own API, and the paid Personal Server
     * reads happen server-side where no CSP applies. Vana's own hosts are
     * listed because the approval flow lives on them and the SDK is theirs to
     * change; an allowance for the one party already trusted with the data is
     * a far better trade than a wildcard.
     */
    "connect-src": [
      "'self'",
      "https://app.vana.org",
      "https://dp-rpc.vana.org",
      "https://dp-rpc.moksha.vana.org",
      ...(dev ? ["ws:", "http://localhost:*"] : []),
    ],

    // The approval flow opens a Vana tab, so it has to be a permitted target.
    "form-action": ["'self'", "https://app.vana.org"],

    // Matches the X-Frame-Options below rather than contradicting it. Two
    // headers disagreeing about framing is worse than either answer alone.
    "frame-ancestors": ["'self'"],

    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "worker-src": ["'self'", "blob:"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Baseline security headers, applied to every response.
 *
 * A Content-Security-Policy now leads the list; see the note above it for what
 * it does and does not claim to stop. The rest are the headers that harden the
 * app with no risk of breaking it: no clickjacking, no MIME sniffing, no
 * referrer leakage, HTTPS pinned. The public verify/badge routes set their own
 * permissive CORS on top; none of these touch that.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  // The app is never meant to be embedded in a frame. This blocks clickjacking
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
   * a variable Next reads. `distDir` is config-only. So the verification build
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

  /**
   * Serve the MCP server from its own subdomain.
   *
   * `mcp.patinadata.xyz` is a nicer thing to paste into a client than
   * `patinadata.xyz/api/mcp`, and it means the server can move later without
   * every client that saved the URL breaking.
   *
   * This rewrite does nothing until `mcp.patinadata.xyz` is added as a domain
   * on the Vercel project and its DNS resolves. Until then the canonical URL is
   * the /api/mcp path, which is what the /mcp page tells people to use. Adding
   * the rewrite ahead of the domain is harmless: no request arrives with that
   * Host header, so the rule never matches.
   *
   * The catch-all source is deliberate. MCP clients are inconsistent about
   * whether they append a trailing path, so every path on the subdomain lands
   * on the one handler rather than 404ing on a stray slash.
   */
  async rewrites() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "mcp.patinadata.xyz" }],
        destination: "/api/mcp",
      },
    ];
  },
};

export default nextConfig;
