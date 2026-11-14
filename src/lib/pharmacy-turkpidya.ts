import { createHash } from "node:crypto";
import { pharmacyCities } from "./pharmacy-cities";
import { istanbulDay, istanbulDistrictKey, type Coordinates, type Pharmacy } from "./pharmacies";
import type { ProviderResult } from "./pharmacy-providers";
import {
  dialNumber, fetchPharmacyJson, PharmacyUpstreamError, readDutyDate, readRecord, readText,
} from "./pharmacy-upstream";

const settings = pharmacyCities.istanbul;
const millisecondsPerHour = 3600000;
const millisecondsPerDay = 24 * millisecondsPerHour;
const maximumRecords = 1000;
const creditPaths = new Set(["/tr/nobetci-eczaneler/", "/istanbul-duty-pharmacies/"]);
const requiredTracking = { utm_source: "api", utm_medium: "credit", utm_campaign: "pharmacies" };
const istanbulDistricts = new Set([
  "adalar", "arnavutkoy", "atasehir", "avcilar", "bagcilar", "bahcelievler", "bakirkoy", "basaksehir",
  "bayrampasa", "besiktas", "beykoz", "beylikduzu", "beyoglu", "buyukcekmece", "catalca", "cekmekoy",
  "esenler", "esenyurt", "eyupsultan", "fatih", "gaziosmanpasa", "gungoren", "kadikoy", "kagithane", "kartal",
  "kucukcekmece", "maltepe", "pendik", "sancaktepe", "sariyer", "silivri", "sultanbeyli", "sultangazi", "sile",
  "sisli", "tuzla", "umraniye", "uskudar", "zeytinburnu",
]);

function normalizedKey(value: string) {
  return value.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replaceAll("ı", "i");
}

function readCreditUrl(value: unknown) {
  const href = readRecord(value)?.url;
  if (typeof href !== "string" || href.length > 2048 || /[\s\\]/u.test(href) || href.includes("\0")) throw new PharmacyUpstreamError();
  const parsed = URL.parse(href);
  if (parsed?.origin !== "https://turkpidya.com" || parsed.username || parsed.password || parsed.hash
    || !creditPaths.has(parsed.pathname)
    || Object.entries(requiredTracking).some(([key, expected]) => {
      const values = parsed.searchParams.getAll(key);
      return values.length !== 1 || values[0] !== expected;
    })) throw new PharmacyUpstreamError();
  // The provider requires the URL and its tracking parameters to be carried through unchanged.
  return href;
}

function readTimestamp(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)
    || !readDutyDate(value.slice(0, 10))) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? { value, instant, date: istanbulDay(new Date(instant)).date } : null;
}

function getDutyDay(now: Date) {
  const { date: calendarDate, midnight } = istanbulDay(now);
  const todayAtNine = midnight - 15 * millisecondsPerHour;
  const yesterday = istanbulDay(new Date(todayAtNine - millisecondsPerDay)).date;
  // Turkpidya's 09:00 rollover helps classify date-only records. Explicit intervals take priority.
  return { calendarDate, date: now.getTime() < todayAtNine ? yesterday : calendarDate };
}

function readCoordinates(lng: unknown, lat: unknown): Coordinates | null {
  const [west, south, east, north] = settings.coordinateBounds;
  return typeof lng === "number" && typeof lat === "number" && lng >= west && lng <= east && lat >= south && lat <= north
    ? [lng, lat] : null;
}

type ScheduledPharmacy = {
  pharmacy: Pharmacy;
  state: "current" | "upcoming" | "unverified";
  boundary: number | null;
};

export function normalizeIstanbulPharmacies(input: unknown, now: Date): ProviderResult & { schedule: NonNullable<ProviderResult["schedule"]> } {
  const payload = readRecord(input);
  const raw = payload?.pharmacies;
  if (!payload || !Array.isArray(raw) || raw.length > maximumRecords || payload.count !== raw.length
    || !Array.isArray(payload.cities_served) || payload.cities_served.some(city => city !== "istanbul")
    || (raw.length > 0 && !payload.cities_served.includes("istanbul"))
    || !Array.isArray(payload.cities_blocked) || payload.cities_blocked.includes("istanbul")) {
    throw new PharmacyUpstreamError();
  }

  const source = { ...settings.source, datasetUrl: readCreditUrl(payload.attribution) };
  const sourceUpdated = readTimestamp(payload.last_updated);
  const local = getDutyDay(now);
  const nowMs = now.getTime();
  const feedDate = readDutyDate(payload.duty_date);
  const cityDate = readDutyDate(readRecord(payload.duty_dates)?.istanbul);
  const declaredDate = cityDate ?? feedDate;
  const conflictingDates = Boolean(feedDate && cityDate && feedDate !== cityDate);
  const dates = new Set([feedDate, cityDate].filter(date => date !== null));
  const rows: ScheduledPharmacy[] = [];
  let invalidRecords = false;
  let expiredRecords = false;

  for (const value of raw) {
    const row = readRecord(value);
    const city = readText(row?.city, 30);
    const name = readText(row?.name, 160);
    if (!row || !name || !city || normalizedKey(city) !== "istanbul" || row.source_state === "unavailable") {
      invalidRecords = true;
      continue;
    }

    const dutyDate = readDutyDate(row.duty_date);
    if (dutyDate) dates.add(dutyDate);
    const start = readTimestamp(row.duty_start);
    const end = readTimestamp(row.duty_end);
    const reliableWindow = start && end && start.date === dutyDate
      && end.instant > start.instant && end.instant - start.instant <= 36 * millisecondsPerHour;
    if (dutyDate && (reliableWindow ? nowMs >= end.instant : dutyDate < local.date)) {
      expiredRecords = true;
      continue;
    }

    const verified = dutyDate && dutyDate === declaredDate && !conflictingDates
      && row.source_state === "current" && sourceUpdated && sourceUpdated.instant <= nowMs
      && sourceUpdated.date >= dutyDate && reliableWindow;
    const state = verified && dutyDate <= local.calendarDate && start.instant <= nowMs && row.open_now !== false ? "current"
      : verified && dutyDate <= local.calendarDate && start.instant > nowMs ? "upcoming" : "unverified";
    const boundary = state === "current" && end ? end.instant : state === "upcoming" && start ? start.instant : null;
    const region = readText(row.district, 100);
    const address = readText(row.address, 600);
    const phone = readText(row.phone, 80);
    const callable = dialNumber(phone);
    const coordinates = readCoordinates(row.lng, row.lat);
    const identity = [
      normalizedKey(name),
      region ? istanbulDistrictKey(region) : null,
      normalizedKey(address ?? callable ?? coordinates?.join(",") ?? ""),
    ];
    const id = "istanbul:turkpidya:" + createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0, 24);
    rows.push({
      state, boundary,
      pharmacy: {
        id, city: "istanbul", name, region, address, phone, dialNumber: callable, dutyDate, dutyNote: null, coordinates,
        ...(reliableWindow ? { dutyStart: start.value, dutyEnd: end.value } : {}),
      },
    });
  }

  if (!rows.length && (expiredRecords || (declaredDate && declaredDate < local.date))) {
    throw new PharmacyUpstreamError("outdated", undefined, declaredDate ?? [...dates][0], source);
  }
  if (!rows.length && raw.length) throw new PharmacyUpstreamError();

  const hasCurrent = rows.some(row => row.state === "current");
  const displayed = hasCurrent ? rows.filter(row => row.state === "current") : rows;
  const status = hasCurrent ? "current" : displayed.length && displayed.every(row => row.state === "upcoming") ? "upcoming" : "unverified";
  const pharmacies = new Map<string, Pharmacy>();
  const districts = new Set<string>();
  for (const { pharmacy } of displayed) {
    const district = pharmacy.region ? istanbulDistrictKey(pharmacy.region) : "";
    if (istanbulDistricts.has(district)) districts.add(district);
    const previous = pharmacies.get(pharmacy.id);
    if (previous && (previous.dutyStart !== pharmacy.dutyStart || previous.dutyEnd !== pharmacy.dutyEnd)) invalidRecords = true;
    pharmacies.set(pharmacy.id, previous ? {
      ...previous,
      coordinates: previous.coordinates ?? pharmacy.coordinates,
      phone: previous.dialNumber || !pharmacy.dialNumber ? previous.phone ?? pharmacy.phone : pharmacy.phone,
      dialNumber: previous.dialNumber ?? pharmacy.dialNumber,
    } : pharmacy);
  }
  const reportedCount = readRecord(payload.cities_available)?.istanbul;
  const reason = dates.size > 1 ? "mixed-dates"
    : invalidRecords || (typeof reportedCount === "number" && reportedCount !== raw.length) ? "invalid-records"
    : expiredRecords || displayed.length < rows.length ? "unverified-records"
    : displayed.length && districts.size < istanbulDistricts.size ? "districts-unverified" : undefined;

  return {
    pharmacies: [...pharmacies.values()],
    dutyDate: dates.size <= 1 || hasCurrent ? declaredDate ?? [...dates][0] ?? null : null,
    source,
    coverage: {
      status: reason ? "partial" : "unknown",
      expectedDistricts: istanbulDistricts.size,
      checkedDistricts: districts.size,
      ...(reason ? { reason } : {}),
    },
    schedule: {
      status,
      sourceUpdatedAt: sourceUpdated && sourceUpdated.instant <= nowMs ? sourceUpdated.value : null,
      validUntil: status === "unverified" ? null : Math.min(...displayed.map(row => row.boundary ?? Infinity)),
    },
  };
}

function responseLifetime(headers: Headers, now: number) {
  const cacheControl = headers.get("cache-control") ?? "";
  const prohibitsReuse = /(?:^|,)\s*(?:private|no-cache|no-store)\s*(?:[=,]|$)/i.test(cacheControl);
  const declaredAges = [...cacheControl.matchAll(/(?:^|,)\s*(?:s-maxage|max-age)\s*=\s*"?(\d+)"?\s*(?=,|$)/gi)]
    .map(match => Number(match[1]));
  // A zero lifetime requires a new upstream request; it does not invalidate the
  // response just fetched. Positive lifetimes and response age still bound its
  // presentation in this client, independently of permission to reuse it.
  const maxAge = Math.min(settings.cacheSeconds, ...declaredAges.filter(age => age > 0)) * 1000;
  const age = headers.get("age") ?? "";
  const ageMs = /^\d+$/.test(age) ? Number(age) * 1000 : 0;
  const originDate = Date.parse(headers.get("date") ?? "");
  const apparentAge = Number.isFinite(originDate) ? now - originDate : 0;
  return {
    milliseconds: Math.max(0, maxAge - Math.max(ageMs, apparentAge)),
    reusable: !prohibitsReuse && !declaredAges.includes(0),
  };
}

export async function loadTurkpidya(fetchSource: typeof fetch, now: () => Date) {
  const { body, headers } = await fetchPharmacyJson(settings.source.url, { fetchSource, allowRetry: () => true });
  const receivedAt = now();
  const result = normalizeIstanbulPharmacies(body, receivedAt);
  const lifetime = responseLifetime(headers, receivedAt.getTime());
  result.schedule.cacheUntil = receivedAt.getTime() + lifetime.milliseconds;
  result.schedule.reusable = lifetime.reusable;
  return result;
}
