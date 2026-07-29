import type { MetadataRoute } from "next";

/**
 * Home-screen identity.
 *
 * Roughly nine in ten visitors arrive on a phone, and a meaningful share of
 * them get here from a link in a chat. Without this they can still "Add to
 * Home Screen", but they get a screenshot of the page as the icon and the
 * browser's own name as the label, which looks like nothing anyone made on
 * purpose.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Patina — proof you have been here a while",
    short_name: "Patina",
    description:
      "Turn the history in accounts you already own into portable proof a real person has been here for years.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0c0b",
    theme_color: "#0b0c0b",
    orientation: "portrait",
    categories: ["productivity", "utilities"],
    icons: [
      {
        // One SVG rather than a spread of PNGs: the mark is four circles, so it
        // scales perfectly and there is nothing to keep in sync.
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
