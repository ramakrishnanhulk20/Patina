import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The four pages worth indexing.
 *
 * Individual `/u/*` cards are left out on purpose even though they are
 * crawlable. There is one per user, they change whenever somebody connects
 * another source, and enumerating them here would mean reading the whole
 * ranked set out of Redis on every crawler visit — the same mistake the
 * standings page was making. They get discovered through shared links, which
 * is how they are meant to be found anyway.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/connect`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/standings`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${SITE_URL}/rewards`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
