import { createHash } from "node:crypto";
import {
  pharmacySource,
  pharmacyTimeZone,
  type Coordinates,
  type Pharmacy,
  type PharmacyResponse,
} from "./pharmacies";

const revalidateSeconds = 900;
const staleIfErrorSeconds = 86400;
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

function istanbulDay(now: Date) {
  const parts = Object.fromEntries(istanbulClock.formatToParts(now).map(({ type, value }) => [type, value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const elapsedSeconds = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  const untilMidnight = (86400 - elapsedSeconds) * 1000 - now.getUTCMilliseconds();
  return { date, untilMidnight };
}

function readDutyDate(value: unknown) {
  if (typeof value !== "string") return null;
  // Tarih is a local duty date. The time component is not a published opening time.
  const date = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,7})?$/.exec(value)?.[1];
  if (!date) return null;
  const day = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().startsWith(date) ? date : null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/gu, " ") || null : null;
}

function readDecimal(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^[+-]?\d+(?:[.,]\d+)?$/.test(value.trim())) {
    return Number(value.trim().replace(",", "."));
  }
  return NaN;
}

function readCoordinates(row: Record<string, unknown>): Coordinates | null {
  // The live feed has latitude in LokasyonX and longitude in LokasyonY.
  const lat = readDecimal(row.LokasyonX);
  const lng = readDecimal(row.LokasyonY);
  // Generous regional bounds catch swapped axes and outliers without requiring a boundary dataset.
  return lat >= 37.5 && lat <= 39.7 && lng >= 25.9 && lng <= 28.8 ? [lng, lat] : null;
}

export function normalizePharmacies(input: unknown): Pharmacy[] {
  if (!Array.isArray(input)) return [];

  const pharmacies = new Map<string, Pharmacy>();
  for (const row of input) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) continue;
    const name = readText(row.Adi);
    const dutyDate = readDutyDate(row.Tarih);
    if (!name || !dutyDate) continue;

    const phone = readText(row.Telefon);
    const nationalNumber = /^(?:\+90|0090|0)?([1-9]\d{9})$/.exec(phone?.replace(/[\s().-]/g, "") ?? "")?.[1];
    const pharmacy = {
      name,
      region: readText(row.Bolge),
      address: readText(row.Adres),
      phone,
      dialNumber: nationalNumber ? `+90${nationalNumber}` : null,
      dutyDate,
      dutyNote: readText(row.BolgeAciklama),
      coordinates: readCoordinates(row),
    };
    // The municipality returned the same EczaneId (-1) for every live record.
    const id = createHash("sha256").update(JSON.stringify(pharmacy)).digest("hex").slice(0, 24);
    pharmacies.set(id, { id, ...pharmacy });
  }
  return [...pharmacies.values()];
}

export async function createPharmacyResponse(fetchSource = fetch, now = () => new Date()): Promise<Response> {
  try {
    const upstream = await fetchSource(pharmacySource.url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!upstream.ok) throw new Error("Pharmacy feed request failed");
    const pharmacies = normalizePharmacies(await upstream.json());
    // An empty or unusable feed must not replace the last usable list at the CDN.
    if (!pharmacies.length) throw new Error("Pharmacy feed contained no usable records");

    const fetchedAt = now();
    const { date, untilMidnight } = istanbulDay(fetchedAt);
    const firstDate = pharmacies[0].dutyDate;
    const dutyDate = pharmacies.every(pharmacy => pharmacy.dutyDate === firstDate) ? firstDate : null;
    const isToday = dutyDate === date;
    const ttlMs = Math.min(revalidateSeconds * 1000, untilMidnight);
    const data: PharmacyResponse = {
      source: pharmacySource,
      dutyDate,
      lastSuccessfulFetchAt: fetchedAt.toISOString(),
      freshness: {
        timeZone: pharmacyTimeZone,
        statusAtFetch: isToday ? "fresh" : "stale",
        freshUntil: isToday ? new Date(fetchedAt.getTime() + ttlMs).toISOString() : null,
      },
      pharmacies,
    };

    return Response.json(data, {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": `public, s-maxage=${Math.floor(ttlMs / 1000)}, stale-if-error=${staleIfErrorSeconds}`,
      },
    });
  } catch {
    const data: PharmacyResponse = {
      source: pharmacySource,
      dutyDate: null,
      lastSuccessfulFetchAt: null,
      freshness: { timeZone: pharmacyTimeZone, statusAtFetch: "unavailable", freshUntil: null },
      pharmacies: [],
    };
    return Response.json(data, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
