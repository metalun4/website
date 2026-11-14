import type { MetadataRoute } from "next";
import { pharmacyCityPath, pharmacyCitySlugs } from "@/lib/pharmacy-cities";
import { instagramFollowCheckerPath, pharmacyPath, siteContentUpdated, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: siteContentUpdated,
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: `${siteUrl}${pharmacyPath}`,
      changeFrequency: "daily",
    },
    ...pharmacyCitySlugs.map(city => ({ url: `${siteUrl}${pharmacyCityPath(city)}`, changeFrequency: "daily" as const })),
    {
      url: `${siteUrl}${instagramFollowCheckerPath}`,
      lastModified: "2026-11-08",
    },
  ];
}
