/**
 * Can this device finish a connection at all?
 *
 * WHY THIS FILE HAD TO EXIST. Connecting a source requires Vana Desktop, a
 * program that runs on macOS, Windows or Linux. Patina said so in a paragraph
 * on the connect page and then handed everybody the same buttons regardless of
 * what they were holding. Tap one on a phone and you were sent to Vana, told to
 * open an app that does not exist for your device, and left on a page we do not
 * control with no way back. The navigation component's own comment puts the
 * phone share of this audience at roughly nine in ten.
 *
 * So the largest hole in the funnel was not a bug in the flow. It was the flow
 * working perfectly for people who could never reach the end of it.
 *
 * WHAT THIS DOES NOT DO is decide whether somebody is welcome. A phone can
 * still read a score, open a public page, verify an attestation and see its own
 * profile. The only thing gated is starting a connection, because that is the
 * only thing that cannot work.
 */

/** The download page for Vana Desktop. macOS, Windows and Linux. */
export const VANA_DESKTOP_DOWNLOAD = "https://app.vana.org/download";

/**
 * User-agent sniffing, which is unreliable, used for something that tolerates
 * being wrong.
 *
 * Sniffing is the wrong tool for deciding what a browser can do and the right
 * one for deciding what to say first, which is all this is for. It runs on the
 * server so the correct screen is in the first response rather than appearing
 * after a flash of the wrong one, and every screen it produces carries a way
 * past it. A desktop misread as a phone loses one click. A phone misread as a
 * desktop loses the person.
 *
 * Ordered deliberately: iPad reports itself as a Mac in desktop mode, so the
 * tablet checks run before the desktop ones rather than after.
 */
export function isDesktopClass(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    // No header at all is a bot, a curl, or a privacy tool. Treat it as capable:
    // the mobile screen is a helpful redirect, not a security control, and
    // showing it to something that never had a device is just noise.
    return true;
  }

  const ua = userAgent.toLowerCase();

  // Phones and tablets, including the ones that lie about being desktops.
  if (/android|iphone|ipod|ipad|windows phone|iemobile|blackberry|bb10|kaios/.test(ua)) {
    return false;
  }
  // iPadOS 13 and later send a Macintosh user agent. Multi-touch is the tell,
  // and it is only detectable client-side, so the server catches the honest
  // ones and useIsDesktopDevice below catches the rest.
  if (/mobile/.test(ua) && !/windows nt|macintosh|x11|cros/.test(ua)) {
    return false;
  }

  return true;
}

/**
 * The same question in the browser, where the answer is better.
 *
 * `maxTouchPoints` is what exposes an iPad pretending to be a Mac, and it does
 * not exist on the server. Used to correct the server's guess after hydration,
 * never to make the first decision, so nobody watches the page change its mind
 * about what they are holding.
 */
export function isDesktopClassInBrowser(): boolean {
  if (typeof navigator === "undefined") return true;
  if (!isDesktopClass(navigator.userAgent)) return false;

  // A Macintosh user agent with a touchscreen is an iPad in desktop mode.
  const touchy = navigator.maxTouchPoints > 1;
  const mac = /macintosh/i.test(navigator.userAgent);
  return !(mac && touchy);
}
