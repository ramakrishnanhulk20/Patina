import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The pages worth indexing.
 *
 * Individual `/u/*` cards are left out on purpose even though they are
 * crawlable. There is one per user, they change whenever somebody connects
 * another source, and enumerating them here would mean reading the whole
 * ranked set out of Redis on every crawler visit. The same mistake the
 * standings page was making. They get discovered through shared links, which
 * is how they are meant to be found anyway.
 *
 * `/mcp` is listed because agent discovery genuinely starts with search: the
 * people looking for a tenure signal to plug into an assistant are searching
 * the open web for one, not browsing patinadata.xyz.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/connect`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/mcp`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/docs`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/verify/offline`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
