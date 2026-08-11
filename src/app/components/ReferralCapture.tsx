"use client";

import { useEffect } from "react";
import { REFERRAL_STORAGE_KEY, normalizeReferralCode } from "@/lib/referral";

/**
 * Mirror an inbound referral code into localStorage, first-write-wins.
 *
 * The proxy already parks ?r= in an httpOnly cookie, and on a laptop that is the
 * end of it. But almost everyone this product reaches is on a phone, opening the
 * link inside an app's in-app browser (X, Instagram, WhatsApp, Telegram), and
 * those webviews are the one place a server cookie is least dependable: some
 * partition it, some wipe it when the view is backgrounded during the Vana
 * approval. localStorage written straight from the URL is subject to none of
 * that. It survives the same tab discard the connect flow already resumes
 * through, so the code gets a second home the connect request can read back and
 * send explicitly.
 *
 * Purely additive. If this never runs (no JS, private mode, storage disabled)
 * the cookie path is exactly as it was. First-write-wins mirrors the cookie: a
 * later link cannot overwrite the credit a friend's link already earned.
 *
 * Mounted globally rather than on the card page alone, because a code can arrive
 * on any route (patina.app/?r=… as much as /u/name?r=…).
 */
export function ReferralCapture() {
  useEffect(() => {
    try {
      const code = normalizeReferralCode(
        new URLSearchParams(window.location.search).get("r"),
      );
      if (!code) return;
      if (window.localStorage.getItem(REFERRAL_STORAGE_KEY)) return;
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
    } catch {
      // Private mode or storage disabled. The cookie path still applies.
    }
  }, []);

  return null;
}
