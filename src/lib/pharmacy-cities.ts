import type { Coordinates } from "./pharmacies";
import { pharmacyPath } from "./site";

export type PharmacySource = {
  id: string;
  name: string;
  url: string;
  datasetUrl: string;
  licenseUrl?: string;
  officialListUrl?: string;
};

type CitySettings = {
  name: string;
  center: Coordinates;
  zoom: number;
  coordinateBounds: [west: number, south: number, east: number, north: number];
  source: PharmacySource;
  cacheSeconds: number;
  allowStaleData: boolean;
  description: string;
};

export const pharmacyCities = {
  izmir: {
    name: "İzmir",
    center: [27.1428, 38.4237],
    zoom: 8.9,
    coordinateBounds: [25.9, 37.5, 28.8, 39.7],
    source: {
      id: "izmir-buyuksehir",
      name: "İzmir Büyükşehir Belediyesi",
      url: "https://openapi.izmir.bel.tr/api/ibb/nobetcieczaneler",
      datasetUrl: "https://acikveri.bizizmir.com/tr/dataset/nobetci-eczaneler-ve-eczane-listesi",
      licenseUrl: "https://acikveri.bizizmir.com/tr/license",
    },
    cacheSeconds: 900,
    allowStaleData: true,
    description: "İzmir Büyükşehir Belediyesi’nin nöbetçi eczane listesini inceleyin. Yakınınızdaki eczaneleri bulun, telefon ve yol tarifine ulaşın.",
  },
  istanbul: {
    name: "İstanbul",
    center: [28.9784, 41.037],
    zoom: 8.9,
    coordinateBounds: [27.9, 40.65, 30.05, 41.65],
    source: {
      id: "turkpidya",
      name: "Turkpidya",
      url: "https://turkpidya.com/wp-json/turkpidya-data/v1/pharmacies/on-duty?city=istanbul&lang=tr",
      datasetUrl: "https://turkpidya.com/tr/nobetci-eczaneler/?utm_source=api&utm_medium=credit&utm_campaign=pharmacies",
      officialListUrl: "https://www.istanbuleczaciodasi.org.tr/nobetci-eczane/",
    },
    cacheSeconds: 300,
    allowStaleData: false,
    description: "İstanbul'daki nöbetçi eczaneleri haritada görüntüleyin. Konumunuza en yakın eczaneleri bulun, telefon ve adres bilgilerine ulaşın, kolayca yol tarifi alın.",
  },
} satisfies Record<string, CitySettings>;

export type PharmacyCity = keyof typeof pharmacyCities;
export const pharmacyCitySlugs = Object.keys(pharmacyCities) as PharmacyCity[];

export function isPharmacyCity(city: string): city is PharmacyCity {
  return Object.hasOwn(pharmacyCities, city);
}

export function pharmacyCityPath(city: PharmacyCity) {
  return `${pharmacyPath}/${city}`;
}
