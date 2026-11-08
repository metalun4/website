import type { MetadataRoute } from "next";
import { instagramFollowCheckerPath, siteContentUpdated, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: siteContentUpdated,
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: `${siteUrl}/nobetci-eczaneler`,
      changeFrequency: "daily",
    },
    {
      url: `${siteUrl}${instagramFollowCheckerPath}`,
      lastModified: "2026-11-08",
    },
  ];
}
