import {MetadataRoute} from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://baris.aydemir.website",
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 1,
    }
  ]
}