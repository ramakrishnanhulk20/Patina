"use client";

import { useEffect } from "react";

/**
 * Dismiss the Farcaster Mini App splash once the app has painted.
 *
 * When Patina is launched from a card embed inside a Farcaster client, the
 * client shows a splash screen and waits for the app to call `ready()`. Without
 * this, the splash never lifts and the Mini App looks hung. On the open web
 * there is no host to call, so the SDK is only loaded and invoked when we are
 * actually inside a Mini App: the dynamic import keeps it out of the normal web
 * bundle, and `isInMiniApp()` gates the call so nothing runs for regular
 * visitors.
 */
export function FarcasterReady() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        if (cancelled) return;
        if (await sdk.isInMiniApp()) await sdk.actions.ready();
      } catch {
        // SDK unavailable or not in a Mini App host: nothing to signal.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
