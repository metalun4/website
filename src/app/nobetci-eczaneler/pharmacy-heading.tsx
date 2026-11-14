import type { Metadata } from "next";
import { pharmacyCities, pharmacyCityPath, type PharmacyCity } from "@/lib/pharmacy-cities";
import { pharmacyPath, siteUrl } from "@/lib/site";

function pageInfo(city?: PharmacyCity) {
  return city ? {
    title: `${pharmacyCities[city].name} Nöbetçi Eczaneler`,
    description: pharmacyCities[city].description,
    path: pharmacyCityPath(city),
  } : {
    title: "Nöbetçi Eczane Bul",
    description: "İzmir ve İstanbul’da yakındaki nöbetçi eczaneleri bulun. İlçe veya eczane adıyla arayın, telefon ve yol tarifine ulaşın.",
    path: pharmacyPath,
  };
}

export function pharmacyMetadata(city?: PharmacyCity): Metadata {
  const info = pageInfo(city);
  const { description, path } = info;
  const title = city === "istanbul" ? "İstanbul Nöbetçi Eczaneler | En Yakın Eczaneyi Haritadan Bul" : info.title;
  return {
    title, description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, locale: "tr_TR", type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export function PharmacyHeading({ city }: { city?: PharmacyCity }) {
  const { title, description, path } = pageInfo(city);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: title,
    url: new URL(path, siteUrl).href,
    description,
    inLanguage: "tr",
    isAccessibleForFree: true,
  };

  return (
    <header className="pharmacy-heading">
      <h1>{title}</h1>
      <p>{description}</p>
      <noscript>
        <p>Harita ve eczane listesini kullanmak için JavaScript’i etkinleştirin.</p>
        {city === "istanbul" ? (
          <p><a href={pharmacyCities.istanbul.source.officialListUrl}>İstanbul Eczacı Odası nöbet listesi</a></p>
        ) : null}
      </noscript>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </header>
  );
}
