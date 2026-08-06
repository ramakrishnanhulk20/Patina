import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * `/u/*` is deliberately left crawlable.
 *
 * Those pages carry a name somebody chose and a number, and nothing that
 * identifies the accounts underneath. That is enforced in the page itself, not
 * here. They are the pages people share, so keeping them indexable is the point.
 *
 * The API is disallowed because there is nothing there a search engine should
 * spend a crawl budget on, and `/api/login` in particular would have crawlers
 * repeatedly starting OAuth flows.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
