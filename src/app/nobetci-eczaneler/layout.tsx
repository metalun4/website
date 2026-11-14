import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ToolsMenu } from "@/components/tools-menu";
import { PharmacyFinder } from "./pharmacy-finder";
import "maplibre-gl/dist/maplibre-gl.css";
import "./pharmacies.css";

export default function PharmacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pharmacy-page" lang="tr">
      <a className="skip-link" href="#pharmacy-results">Eczane listesine geç</a>
      <nav aria-label="Site gezinmesi" className="relative z-20 mb-3 flex items-center justify-between gap-3 border-b border-border text-sm">
        <Link href="/" prefetch={false} className="portfolio-nav">
          <ArrowLeft size={16} aria-hidden="true" /> Ana sayfa
        </Link>
        <ToolsMenu label="Araçlar" />
      </nav>
      <main><PharmacyFinder>{children}</PharmacyFinder></main>
    </div>
  );
}
