import type { NextConfig } from "next";

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
};

export default nextConfig;
