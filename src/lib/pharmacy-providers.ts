import { createHash } from "node:crypto";
import { pharmacyCities, type PharmacyCity, type PharmacySource } from "./pharmacy-cities";
import type { Coordinates, Pharmacy, PharmacyCoverage } from "./pharmacies";
import { loadTurkpidya } from "./pharmacy-turkpidya";
import {
  dialNumber, fetchPharmacyJson, PharmacyUpstreamError, readDutyDate, readRecord, readText,
} from "./pharmacy-upstream";

export { normalizeIstanbulPharmacies } from "./pharmacy-turkpidya";

export type ProviderResult = {
  pharmacies: Pharmacy[];
  dutyDate: string | null;
  coverage: PharmacyCoverage;
  source?: PharmacySource;
  schedule?: {
    status: "current" | "upcoming" | "unverified";
    sourceUpdatedAt: string | null;
    validUntil: number | null;
    cacheUntil?: number;
    reusable?: boolean;
  };
};

type ProviderLoad = (fetchSource: typeof fetch, now: () => Date) => Promise<ProviderResult>;

function readDecimal(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^[+-]?\d+(?:[.,]\d+)?$/.test(value.trim())) {
    return Number(value.trim().replace(",", "."));
  }
  return NaN;
}

function coordinatesInCity(city: PharmacyCity, lng: number, lat: number): Coordinates | null {
  const [west, south, east, north] = pharmacyCities[city].coordinateBounds;
  return lng >= west && lng <= east && lat >= south && lat <= north ? [lng, lat] : null;
}

export function normalizeIzmirPharmacies(input: unknown): ProviderResult {
  if (!Array.isArray(input) || input.length > 1000) throw new PharmacyUpstreamError();

  const pharmacies = new Map<string, Pharmacy>();
  const dates = new Set<string>();
  let skipped = 0;
  for (const value of input) {
    const row = readRecord(value);
    const name = readText(row?.Adi, 160);
    // Tarih is a local calendar date. Its time component is not a published opening time.
    const timestamp = typeof row?.Tarih === "string"
      ? /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?$/.exec(row.Tarih)
      : null;
    const dutyDate = readDutyDate(timestamp?.[1]);
    if (!row || !name || !dutyDate) {
      skipped++;
      continue;
    }

    const phone = readText(row.Telefon, 80);
    const region = readText(row.Bolge, 160);
    const address = readText(row.Adres, 600);
    // The municipality reuses EczaneId (-1). Identity uses stable contact/location fields.
    const identity = [name, region, address].map(text => text?.toLocaleLowerCase("tr").normalize("NFC"));
    const id = `izmir:izmir-buyuksehir:${createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0, 24)}`;
    dates.add(dutyDate);
    if (!pharmacies.has(id)) pharmacies.set(id, {
      id, city: "izmir", name, region, address, phone, dialNumber: dialNumber(phone), dutyDate,
      dutyNote: readText(row.BolgeAciklama, 450),
      // The municipality's X field is latitude and Y field is longitude.
      coordinates: coordinatesInCity("izmir", readDecimal(row.LokasyonY), readDecimal(row.LokasyonX)),
    });
  }

  return {
    pharmacies: [...pharmacies.values()],
    dutyDate: dates.size === 1 ? [...dates][0] : null,
    coverage: skipped ? { status: "partial", reason: "invalid-records" } : { status: "complete" },
  };
}

async function loadIzmir(fetchSource: typeof fetch) {
  const { body } = await fetchPharmacyJson(pharmacyCities.izmir.source.url, { fetchSource, allowRetry: () => true });
  return normalizeIzmirPharmacies(body);
}

export const pharmacyProviders: Record<PharmacyCity, ProviderLoad> = { izmir: loadIzmir, istanbul: loadTurkpidya };
