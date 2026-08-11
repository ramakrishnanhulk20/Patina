/**
 * Farcaster Mini App wiring, in one place.
 *
 * Patina's distribution is people posting their card. Farcaster is where the
 * crowd that cares about "provably not a bot" already lives, so a card cast
 * there should not be a dead image: it should render as a Mini App embed with a
 * launch button, and open Patina inside the client with no context switch.
 *
 * This file only builds the metadata. Two consumers use it: the card page, which
 * stamps the per-card embed into its <head>, and the /.well-known/farcaster.json
 * route, which serves the app manifest. Keeping both here means the app's name,
 * splash and icon can never drift between the embed and the manifest.
 *
 * Spec: https://miniapps.farcaster.xyz  (embeds + manifest, "version": "1").
 */
import { SITE_URL, siteUrl } from "./site";

/** The near-black app ground, so the launch splash matches the app it opens. */
const SPLASH_BG = "#0b100e";
const APP_NAME = "Patina";
const BUTTON_TITLE = "Get your Patina score";

/** A raster app icon Farcaster can use for the splash and app listing. */
const ICON_URL = siteUrl("/apple-icon");

type LaunchType = "launch_miniapp" | "launch_frame";

/**
 * The embed a single card carries.
 *
 * Emitted twice per card: once as `fc:miniapp` (current) and once as `fc:frame`
 * (the older tag name), with the matching launch action type, so both current
 * and older Farcaster clients render the card rather than one falling back to a
 * plain link.
 */
export function cardEmbed(username: string, kind: LaunchType) {
  const url = siteUrl(`/u/${encodeURIComponent(username)}`);
  return {
    version: "1",
    imageUrl: siteUrl(`/u/${encodeURIComponent(username)}/opengraph-image`),
    button: {
      title: BUTTON_TITLE,
      action: {
        type: kind,
        name: APP_NAME,
        url,
        splashImageUrl: ICON_URL,
        splashBackgroundColor: SPLASH_BG,
      },
    },
  };
}

/**
 * The two <head> tags a card needs, ready to spread into Next's `other` metadata.
 */
export function cardEmbedTags(username: string): Record<string, string> {
  return {
    "fc:miniapp": JSON.stringify(cardEmbed(username, "launch_miniapp")),
    "fc:frame": JSON.stringify(cardEmbed(username, "launch_frame")),
  };
}

/**
 * The domain manifest served at /.well-known/farcaster.json.
 *
 * `accountAssociation` is the signed proof that this domain belongs to a
 * Farcaster account; it is generated once by the owner in the Farcaster
 * developer tools and pasted in as three env vars. It is omitted until then, so
 * the embed still renders and the app simply is not yet publishable/searchable
 * rather than the route 500ing on a missing secret.
 */
export function farcasterManifest() {
  const header = process.env.FARCASTER_HEADER;
  const payload = process.env.FARCASTER_PAYLOAD;
  const signature = process.env.FARCASTER_SIGNATURE;
  const associated = header && payload && signature;

  const miniapp = {
    version: "1",
    name: APP_NAME,
    iconUrl: ICON_URL,
    homeUrl: SITE_URL,
    imageUrl: siteUrl("/opengraph-image"),
    buttonTitle: BUTTON_TITLE,
    splashImageUrl: ICON_URL,
    splashBackgroundColor: SPLASH_BG,
    // Farcaster caps subtitle at 30 chars and description at 170. Keep both
    // under, or the manifest fails validation on submit.
    subtitle: "How far back you really go",
    description:
      "Anyone can make a new account. Nobody can make an old one. Patina reads the history you already have and scores how far back you really go.",
    primaryCategory: "social",
    tags: ["identity", "proof-of-personhood", "vana", "reputation"],
  };

  return {
    ...(associated
      ? { accountAssociation: { header, payload, signature } }
      : {}),
    // Both keys, same object, so current ("miniapp") and older ("frame")
    // manifest readers each find what they expect.
    miniapp,
    frame: miniapp,
  };
}
