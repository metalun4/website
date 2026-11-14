import type { PharmacyCity, PharmacySource } from "./pharmacy-cities";

export const pharmacyTimeZone = "Europe/Istanbul";

export type Coordinates = [longitude: number, latitude: number];
export type Pharmacy = {
  id: string;
  city: PharmacyCity;
  name: string;
  region: string | null;
  address: string | null;
  phone: string | null;
  dialNumber: string | null;
  dutyDate: string | null;
  dutyStart?: string;
  dutyEnd?: string;
  dutyNote: string | null;
  coordinates: Coordinates | null;
};

export type PharmacyFreshness = "fresh" | "stale" | "unknown" | "upcoming" | "unavailable";
export type PharmacyCoverage = {
  status: "complete" | "partial" | "unknown";
  expectedDistricts?: number;
  checkedDistricts?: number;
  reason?: "districts-unverified" | "mixed-dates" | "invalid-records" | "unverified-records";
};

export type PharmacyResponse = {
  city: PharmacyCity;
  source: PharmacySource;
  dutyDate: string | null;
  dutyDateStatus: "reported-today" | "verified" | "upcoming" | "unverified" | "outdated";
  lastSuccessfulFetchAt: string | null;
  sourceUpdatedAt?: string | null;
  freshness: {
    timeZone: typeof pharmacyTimeZone;
    statusAtFetch: PharmacyFreshness;
    cacheUntil: string | null;
    freshUntil: string | null;
    expiresAt: string | null;
  };
  coverage: PharmacyCoverage;
  unavailableReason?: "outdated" | "rate-limited" | "provider-error";
  pharmacies: Pharmacy[];
};

export function getPharmacyFreshness(data: PharmacyResponse, now: number): PharmacyFreshness {
  const { statusAtFetch, freshUntil, expiresAt } = data.freshness;
  if (!expiresAt || now >= Date.parse(expiresAt) || statusAtFetch === "unavailable") return "unavailable";
  if (statusAtFetch !== "fresh") return statusAtFetch;
  return freshUntil && now < Date.parse(freshUntil) ? "fresh" : "stale";
}

const istanbulClock = new Intl.DateTimeFormat("en", {
  timeZone: pharmacyTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function istanbulDay(now: Date) {
  const parts = Object.fromEntries(istanbulClock.formatToParts(now).map(({ type, value }) => [type, value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const elapsedSeconds = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  const midnight = now.getTime() + (86400 - elapsedSeconds) * 1000 - now.getUTCMilliseconds();
  return { date, midnight };
}

export function retryAfterSeconds(header: string | null, now = Date.now()) {
  if (!header) return undefined;
  if (/^\d+$/.test(header)) {
    const seconds = Number(header);
    return Number.isSafeInteger(seconds) ? Math.max(1, seconds) : undefined;
  }
  const deadline = Date.parse(header);
  return Number.isFinite(deadline) ? Math.max(1, Math.ceil((deadline - now) / 1000)) : undefined;
}

function searchText(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replaceAll("ı", "i");
}

export function istanbulDistrictKey(value: string) {
  const key = searchText(value).replace(/[^a-z]/g, "");
  return key === "eyup" ? "eyupsultan" : key;
}

export function filterPharmacies(pharmacies: Pharmacy[], query: string): Pharmacy[] {
  const terms = searchText(query).trim().split(/\s+/);
  if (!terms[0]) return pharmacies;

  return pharmacies.filter(pharmacy => {
    const district = pharmacy.city === "istanbul" && pharmacy.region ? istanbulDistrictKey(pharmacy.region) : "";
    const text = searchText([pharmacy.name, pharmacy.region, pharmacy.address].join(" ")) + " " + district;
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

const pharmacyOrder = new Intl.Collator("tr-TR", { sensitivity: "base" });

export function rankPharmacies(pharmacies: Pharmacy[], origin: Coordinates | null) {
  return pharmacies.map(pharmacy => ({
    pharmacy,
    distance: origin && pharmacy.coordinates ? distanceKm(origin, pharmacy.coordinates) : null,
  })).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)
    || pharmacyOrder.compare(a.pharmacy.name, b.pharmacy.name));
}

export function navigationLinks([lng, lat]: Coordinates) {
  const destination = encodeURIComponent(`${lat},${lng}`);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${destination}&dir_action=navigate`,
    apple: `https://maps.apple.com/directions?destination=${destination}`,
  };
}
