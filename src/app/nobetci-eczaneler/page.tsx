import type { Metadata } from "next";
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
    <main className="pharmacy-page" lang="tr">
      <a className="skip-link" href="#pharmacy-results">Eczane listesine geç</a>
      <header className="pharmacy-heading">
        <h1>{title}</h1>
        <p>Eczaneleri haritada bulun, telefon ve adres bilgilerine ulaşın.</p>
      </header>

      <PharmacyFinder />
    </main>
  );
}
