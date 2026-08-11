"use client";

import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

/**
 * Dismiss the Farcaster Mini App splash once the app has painted.
 *
 * When Patina is launched from a card embed inside a Farcaster client, the
 * client shows a splash and waits for the app to call `ready()`; without it the
 * splash never lifts and the Mini App looks hung (the developer preview warns
 * "Ready not called").
 *
 * The SDK is imported STATICALLY, on purpose. The earlier version loaded it with
 * a dynamic import() inside the effect; if that chunk was slow or failed to load
 * in the Farcaster webview, the call was delayed past the host's check or never
 * happened at all, so the splash hung. A static import is already in the bundle,
 * so `ready()` fires immediately with nothing to fetch first. The SDK is
 * SSR-safe (it touches no browser globals at module load), so this does not
 * break the server render. Outside a Mini App there is no host listening, which
 * is why the call is fired and forgotten rather than awaited.
 */
export function FarcasterReady() {
  useEffect(() => {
    sdk.actions.ready().catch(() => {
      // No Mini App host to signal (e.g. the open web): nothing to do.
    });
  }, []);

  return null;
}
