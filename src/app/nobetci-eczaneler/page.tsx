import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ToolsMenu } from "@/components/tools-menu";
import { PharmacyFinder } from "./pharmacy-finder";
import "maplibre-gl/dist/maplibre-gl.css";
import "./pharmacies.css";

const title = "İzmir Nöbetçi Eczaneler";
const description = "İzmir Büyükşehir Belediyesi’nin nöbetçi eczane listesini haritada görün. Eczane adı, bölge veya adresle arayın, telefon ve yol tarifine ulaşın.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/nobetci-eczaneler" },
  openGraph: { title, description, url: "/nobetci-eczaneler", locale: "tr_TR", type: "website" },
};

export default function PharmaciesPage() {
  return (
    <div className="pharmacy-page" lang="tr">
      <a className="skip-link" href="#pharmacy-results">Eczane listesine geç</a>
      <nav aria-label="Site gezinmesi" className="relative z-20 mb-3 flex items-center justify-between gap-3 border-b border-border text-sm">
        <Link href="/" prefetch={false} className="portfolio-nav">
          <ArrowLeft size={16} aria-hidden="true" /> Ana sayfa
        </Link>
        <ToolsMenu label="Araçlar" currentPath="/nobetci-eczaneler" />
      </nav>
      <main>
        <header className="pharmacy-heading">
          <h1>{title}</h1>
          <p>Eczaneleri haritada bulun, telefon ve adres bilgilerine ulaşın.</p>
        </header>

        <PharmacyFinder />
      </main>
    </div>
  );
}
