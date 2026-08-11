"use client";

import { useEffect } from "react";

/**
 * Dismiss the Farcaster Mini App splash once the app has painted.
 *
 * When Patina is launched from a card embed inside a Farcaster client, the
 * client shows a splash and waits for the app to call `ready()`; without it the
 * splash never lifts and the Mini App looks hung (the developer preview warns
 * "Ready not called").
 *
 * Called directly, as Farcaster's docs prescribe, NOT behind `isInMiniApp()`:
 * that gate was returning false in the host and suppressing the call, which is
 * exactly the hang it was meant to avoid. Outside a Mini App there is simply no
 * host listening, so the call is a harmless no-op. The SDK is still dynamically
 * imported so it stays out of the main web bundle.
 */
export function FarcasterReady() {
  useEffect(() => {
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        await sdk.actions.ready();
      } catch {
        // No Mini App host to signal, or the SDK failed to load: nothing to do.
      }
    })();
  }, []);

  return null;
}
