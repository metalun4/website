export const pharmacySource = {
  name: "İzmir Büyükşehir Belediyesi",
  url: "https://openapi.izmir.bel.tr/api/ibb/nobetcieczaneler",
  datasetUrl: "https://acikveri.bizizmir.com/tr/dataset/nobetci-eczaneler-ve-eczane-listesi",
  licenseUrl: "https://acikveri.bizizmir.com/tr/license",
};

export const pharmacyTimeZone = "Europe/Istanbul";

export type Coordinates = [longitude: number, latitude: number];
export type Pharmacy = {
  id: string;
  name: string;
  region: string | null;
  address: string | null;
  phone: string | null;
  dialNumber: string | null;
  dutyDate: string;
  dutyNote: string | null;
  coordinates: Coordinates | null;
};

export type PharmacyFreshness = "fresh" | "stale" | "unavailable";
export type PharmacyResponse = {
  source: typeof pharmacySource;
  dutyDate: string | null;
  lastSuccessfulFetchAt: string | null;
  freshness: {
    timeZone: typeof pharmacyTimeZone;
    // A shared cache may serve this snapshot after its validity window.
    statusAtFetch: PharmacyFreshness;
    freshUntil: string | null;
  };
  pharmacies: Pharmacy[];
};

export function getPharmacyFreshness(data: PharmacyResponse, now: number): PharmacyFreshness {
  const { statusAtFetch, freshUntil } = data.freshness;
  if (statusAtFetch !== "fresh") return statusAtFetch;
  return freshUntil && now < Date.parse(freshUntil) ? "fresh" : "stale";
}

function searchText(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ı", "i");
}

export function filterPharmacies(pharmacies: Pharmacy[], query: string): Pharmacy[] {
  const terms = searchText(query).trim().split(/\s+/);
  if (!terms[0]) return pharmacies;

  return pharmacies.filter(pharmacy => {
    const text = searchText([pharmacy.name, pharmacy.region, pharmacy.address].join(" "));
    return terms.every(term => text.includes(term));
  });
}

export function distanceKm([fromLng, fromLat]: Coordinates, [toLng, toLat]: Coordinates) {
  const radians = Math.PI / 180;
  const lat = Math.sin((toLat - fromLat) * radians / 2);
  const lng = Math.sin((toLng - fromLng) * radians / 2);
  const a = lat ** 2 + lng ** 2 * Math.cos(fromLat * radians) * Math.cos(toLat * radians);
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, a)));
}
