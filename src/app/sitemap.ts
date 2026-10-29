import type { MetadataRoute } from "next";
import { siteContentUpdated, siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: siteContentUpdated,
      changeFrequency: "yearly",
      priority: 1,
    },
  ];
}
