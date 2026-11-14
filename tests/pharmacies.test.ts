import assert from "node:assert/strict";
import { test } from "node:test";
import turkpidyaFixture from "./fixtures/turkpidya-istanbul.json";
import { pharmacyCities, type PharmacyCity } from "../src/lib/pharmacy-cities";
import { createPharmacyFeedLoader, createPharmacyResponse, loadPharmacyFeed } from "../src/lib/pharmacy-feed";
import { geolocationError, locatePharmacyCity } from "../src/lib/pharmacy-geography";
import { normalizeIstanbulPharmacies, normalizeIzmirPharmacies } from "../src/lib/pharmacy-providers";
import {
  distanceKm, filterPharmacies, getPharmacyFreshness, navigationLinks, rankPharmacies, retryAfterSeconds,
  type Coordinates, type PharmacyResponse,
} from "../src/lib/pharmacies";

const day = "2026-11-08";
const noon = day + "T12:00:00.000Z";
const municipalRow = {
  Tarih: day + "T08:00:00",
  LokasyonY: "27.192712",
  LokasyonX: "38.428346",
  BolgeAciklama: "24:00DEN SONRA- ÇAMDİBİ",
  Adi: "YENİ TUNCAY ECZANESİ",
  Telefon: "02324356177",
  Adres: "TUNA MAH. FAZIL PAŞA CAD. NO:35/A KOŞUKAVAK",
  EczaneId: -1,
  Bolge: "ALTINDAĞ",
};

const istanbulNow = "2026-11-10T20:55:00.000Z";
const istanbulDate = "2026-11-10";
const districts = [
  "Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş",
  "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih",
  "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer",
  "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu",
];

type TurkpidyaRow = Record<string, unknown>;
function turkpidyaPayload(rows: TurkpidyaRow[] = structuredClone(turkpidyaFixture.pharmacies)) {
  return { ...structuredClone(turkpidyaFixture), pharmacies: rows, count: rows.length, cities_available: { istanbul: rows.length } };
}

// Synthetic coverage expansion uses the observed row schema, not extra live records.
function allDistrictsPayload() {
  return turkpidyaPayload(districts.map((district, index) => ({
    ...turkpidyaFixture.pharmacies[0], name: "TEST ECZANESİ " + index, district,
  })));
}

function turkpidyaResponse(payload: unknown = turkpidyaPayload(), headers: HeadersInit = { "Cache-Control": "public, max-age=300, s-maxage=300" }) {
  return Response.json(payload, { headers });
}

async function snapshot(city: PharmacyCity, fetchSource: typeof fetch, at = noon) {
  const now = () => new Date(at);
  const response = await createPharmacyResponse(city, createPharmacyFeedLoader(fetchSource, now), now);
  const data: PharmacyResponse = await response.json();
  return { response, data };
}

test("İzmir normalizes observed axes and keeps identity stable across daily schedules", () => {
  const other = { ...municipalRow, Adi: "YENİ GÖKSEN ECZANESİ", Bolge: "BALÇOVA" };
  const [pharmacy, second] = normalizeIzmirPharmacies([municipalRow, municipalRow, other]).pharmacies;
  assert.match(pharmacy.id, /^izmir:izmir-buyuksehir:[a-f0-9]+$/);
  assert.deepEqual(pharmacy, {
    id: pharmacy.id, city: "izmir",
    name: municipalRow.Adi, address: municipalRow.Adres, region: municipalRow.Bolge,
    phone: municipalRow.Telefon, dialNumber: "+902324356177",
    dutyDate: day, dutyNote: municipalRow.BolgeAciklama, coordinates: [27.192712, 38.428346],
  });
  assert.notEqual(pharmacy.id, second.id);
  const nextDuty = { ...municipalRow, Tarih: "2026-11-09T08:00:00", BolgeAciklama: "Yeni not", Telefon: null };
  assert.equal(normalizeIzmirPharmacies([nextDuty]).pharmacies[0].id, pharmacy.id);
  assert.equal(normalizeIzmirPharmacies([municipalRow, nextDuty]).dutyDate, null);
});

test("İzmir preserves records with unusable coordinates, and validates dates and dialable phones", () => {
  for (const [LokasyonX, LokasyonY] of [
    ["27.192712", "38.428346"], ["0", "0"], ["", "27.1"], [null, "27.1"],
    [38.4, Infinity], [38.4, "27.1x"], [38.4, "0x1b"], [38.4, "27.1,2"], [41, 29],
  ]) {
    const [pharmacy] = normalizeIzmirPharmacies([{ ...municipalRow, LokasyonX, LokasyonY }]).pharmacies;
    assert.equal(pharmacy.coordinates, null);
    assert.equal(pharmacy.dialNumber, "+902324356177");
  }
  const data = normalizeIzmirPharmacies([
    null, 5, [], {}, { ...municipalRow, Adi: " " },
    { ...municipalRow, Tarih: "2026-02-29T08:00:00" }, { ...municipalRow, Tarih: day + "T24:00:00" },
    { ...municipalRow, LokasyonX: " 38,428346 ", LokasyonY: 27.192712, Telefon: "(0232) 435 61 77" },
    { Adi: " Şirinyer   Eczanesi ", Tarih: "2028-02-29T08:00:00.123", Telefon: "javascript:0" },
  ]);
  assert.equal(data.coverage.status, "partial");
  assert.equal(data.pharmacies.length, 2);
  assert.deepEqual(data.pharmacies[0].coordinates, [27.192712, 38.428346]);
  assert.equal(data.pharmacies[0].dialNumber, "+902324356177");
  assert.equal(data.pharmacies[1].name, "Şirinyer Eczanesi");
  assert.equal(data.pharmacies[1].dialNumber, null);
  assert.equal(data.pharmacies[1].address, null);
});

test("Turkpidya normalizes the verified schema, coordinates, identity and exact attribution URL", () => {
  const payload = turkpidyaPayload();
  const result = normalizeIstanbulPharmacies(payload, new Date(istanbulNow));
  const [pharmacy] = result.pharmacies;
  assert.equal(result.pharmacies.length, 3);
  assert.match(pharmacy.id, /^istanbul:turkpidya:[a-f0-9]+$/);
  assert.equal(pharmacy.name, payload.pharmacies[0].name);
  assert.equal(pharmacy.city, "istanbul");
  assert.equal(pharmacy.region, "Başakşehir");
  assert.deepEqual(pharmacy.coordinates, [28.78624291521109, 41.12419081340612]);
  assert.equal(pharmacy.dialNumber, "+902120000000");
  assert.equal(pharmacy.dutyDate, istanbulDate);
  assert.equal(pharmacy.dutyStart, "2026-11-10T19:00:00+03:00");
  assert.equal(pharmacy.dutyEnd, "2026-11-11T09:00:00+03:00");
  assert.equal(result.source?.datasetUrl, turkpidyaFixture.attribution.url);
  assert.equal(result.schedule?.status, "current");
  assert.equal(result.schedule?.sourceUpdatedAt, turkpidyaFixture.last_updated);
  assert.equal("html" in (result.source ?? {}), false);
  const repeated = normalizeIstanbulPharmacies(turkpidyaPayload([...payload.pharmacies, payload.pharmacies[0]]), new Date(istanbulNow));
  assert.equal(repeated.pharmacies.length, 3);
  assert.equal(repeated.pharmacies[0].id, pharmacy.id);
  const nextRows = payload.pharmacies.map(row => ({
    ...row, duty_date: "2026-11-11", duty_start: "2026-11-11T19:00:00+03:00", duty_end: "2026-11-12T09:00:00+03:00", phone: "02121234567",
  }));
  const nextPayload = { ...turkpidyaPayload(nextRows), duty_date: "2026-11-11", duty_dates: { istanbul: "2026-11-11" }, last_updated: "2026-11-11T23:00:00+03:00" };
  assert.equal(normalizeIstanbulPharmacies(nextPayload, new Date("2026-11-11T20:55:00Z")).pharmacies[0].id, pharmacy.id);
});

test("Turkpidya preserves missing or invalid location/contact data without fabricating values", () => {
  for (const coordinates of [
    { lat: null, lng: null }, { lat: "", lng: 28.8 }, { lat: 28.8, lng: 41.1 },
    { lat: 0, lng: 0 }, { lat: Infinity, lng: 29 }, { lat: "41.1x", lng: 29 }, { lat: 38.4, lng: 27.1 },
  ]) {
    const row = { ...turkpidyaFixture.pharmacies[0], ...coordinates, phone: "not a phone", address: null };
    const [pharmacy] = normalizeIstanbulPharmacies(turkpidyaPayload([row]), new Date(istanbulNow)).pharmacies;
    assert.equal(pharmacy.coordinates, null);
    assert.equal(pharmacy.dialNumber, null);
    assert.equal(pharmacy.address, null);
  }
  const row = { ...turkpidyaFixture.pharmacies[0], phone: "+90 (212) 123 45 67" };
  assert.equal(normalizeIstanbulPharmacies(turkpidyaPayload([row]), new Date(istanbulNow)).pharmacies[0].dialNumber, "+902121234567");
});

test("Turkpidya rejects mismatched envelopes and excludes malformed or wrong-city rows", () => {
  const now = new Date(istanbulNow);
  const payload = turkpidyaPayload();
  for (const invalid of [
    null, [], {}, { ...payload, count: 99 }, { ...payload, pharmacies: {} },
    { ...payload, cities_served: ["izmir"] }, { ...payload, cities_blocked: ["istanbul"] },
  ]) assert.throws(() => normalizeIstanbulPharmacies(invalid, now));
  const rows = [payload.pharmacies[0], { ...payload.pharmacies[1], city: "izmir" }, {}, { ...payload.pharmacies[2], name: " " }];
  const result = normalizeIstanbulPharmacies(turkpidyaPayload(rows), now);
  assert.equal(result.pharmacies.length, 1);
  assert.equal(result.coverage.status, "partial");
});

test("Turkpidya requires safe visible attribution and preserves its query parameters", () => {
  const payload = turkpidyaPayload();
  for (const attribution of [
    undefined, null, {}, { ...payload.attribution, url: "javascript:alert(1)" },
    { ...payload.attribution, url: "https://turkpidya.com.evil.example/?utm_source=api&utm_medium=credit&utm_campaign=pharmacies" },
    { ...payload.attribution, url: "https://user:pass@turkpidya.com/tr/nobetci-eczaneler/" },
    { ...payload.attribution, url: "https://turkpidya.com/tr/nobetci-eczaneler/" },
  ]) assert.throws(() => normalizeIstanbulPharmacies({ ...payload, attribution }, new Date(istanbulNow)));
  const hostileHtml = { ...payload, attribution: { ...payload.attribution, html: "<img src=x onerror=alert(1)>" } };
  assert.equal(normalizeIstanbulPharmacies(hostileHtml, new Date(istanbulNow)).source?.datasetUrl, payload.attribution.url);
});

test("Turkpidya verifies overnight duties using the actual interval across Istanbul midnight", () => {
  const payload = turkpidyaPayload();
  const overnight = normalizeIstanbulPharmacies(payload, new Date("2026-11-10T21:01:00Z"));
  assert.equal(overnight.dutyDate, istanbulDate);
  assert.equal(overnight.schedule?.status, "current");
  assert.equal(overnight.pharmacies.length, 3);
  const atEnd = new Date("2026-11-11T06:00:00Z");
  assert.throws(() => normalizeIstanbulPharmacies(payload, atEnd), { reason: "outdated" });
  assert.throws(() => normalizeIstanbulPharmacies(payload, new Date("2026-12-10T20:55:00Z")), { reason: "outdated" });
});

test("Turkpidya separates upcoming and unverifiable duty records from confirmed active pharmacies", () => {
  const payload = turkpidyaPayload();
  const upcoming = { ...payload, last_updated: "2026-11-10T18:00:00+03:00", pharmacies: payload.pharmacies.map(row => ({ ...row, open_now: false })) };
  assert.equal(normalizeIstanbulPharmacies(upcoming, new Date("2026-11-10T15:30:00Z")).schedule?.status, "upcoming");
  const unknown = turkpidyaPayload(payload.pharmacies.map(row => ({ ...row, duty_start: null, duty_end: null, open_now: null })));
  const result = normalizeIstanbulPharmacies(unknown, new Date(istanbulNow));
  assert.equal(result.schedule?.status, "unverified");
  assert.ok(result.pharmacies.every(row => !row.dutyStart && !row.dutyEnd));
  const closed = turkpidyaPayload(payload.pharmacies.map(row => ({ ...row, open_now: false })));
  assert.equal(normalizeIstanbulPharmacies(closed, new Date(istanbulNow)).schedule?.status, "unverified");
});

test("Turkpidya honors an explicitly longer overnight duty without accepting days-old periods", () => {
  const payload = {
    ...turkpidyaPayload(turkpidyaFixture.pharmacies.map(row => ({ ...row, duty_end: "2026-11-11T10:00:00+03:00" }))),
    last_updated: "2026-11-11T09:10:00+03:00",
  };
  const result = normalizeIstanbulPharmacies(payload, new Date("2026-11-11T06:30:00Z"));
  assert.equal(result.schedule.status, "current");
  assert.equal(result.schedule.validUntil, Date.parse("2026-11-11T07:00:00Z"));
  const ancient = {
    ...turkpidyaPayload(turkpidyaFixture.pharmacies.map(row => ({
      ...row, duty_date: "2026-10-11", duty_start: "2026-10-11T19:00:00+03:00", duty_end: "2026-11-11T10:00:00+03:00",
    }))),
    duty_date: "2026-10-11", duty_dates: { istanbul: "2026-10-11" },
  };
  assert.throws(() => normalizeIstanbulPharmacies(ancient, new Date(istanbulNow)), { reason: "outdated" });
});

test("Turkpidya honors a reliable active interval crossing two midnights until its exact end", async () => {
  const payload = {
    ...allDistrictsPayload(),
    duty_date: "2026-11-09", duty_dates: { istanbul: "2026-11-09" },
    last_updated: "2026-11-11T00:01:00+03:00",
    pharmacies: allDistrictsPayload().pharmacies.map(row => ({
      ...row, duty_date: "2026-11-09", duty_start: "2026-11-09T23:00:00+03:00", duty_end: "2026-11-11T09:00:00+03:00",
    })),
  };
  const now = "2026-11-11T00:02:00+03:00";
  const result = normalizeIstanbulPharmacies(payload, new Date(now));
  assert.equal(result.schedule.status, "current");
  assert.equal(result.schedule.validUntil, Date.parse("2026-11-11T09:00:00+03:00"));
  const { response, data } = await snapshot("istanbul", async () => turkpidyaResponse(payload), now);
  assert.equal(response.status, 200);
  assert.equal(data.dutyDateStatus, "verified");
  assert.equal(data.pharmacies.length, 39);
  assert.throws(() => normalizeIstanbulPharmacies(payload, new Date("2026-11-11T09:00:00+03:00")), { reason: "outdated" });
  for (const dutyStart of [null, "2026-11-09T20:00:00+03:00"]) {
    const invalid = { ...payload, pharmacies: payload.pharmacies.map(row => ({ ...row, duty_start: dutyStart })) };
    assert.throws(() => normalizeIstanbulPharmacies(invalid, new Date(now)), { reason: "outdated" });
  }
});

test("Turkpidya identifies partial district coverage, mixed dates and empty responses", () => {
  const now = new Date(istanbulNow);
  const subset = normalizeIstanbulPharmacies(turkpidyaPayload(), now);
  assert.equal(subset.coverage.status, "partial");
  assert.equal(subset.coverage.expectedDistricts, 39);
  assert.equal(subset.coverage.checkedDistricts, 3);
  const full = normalizeIstanbulPharmacies(allDistrictsPayload(), now);
  assert.equal(full.coverage.checkedDistricts, 39);
  assert.notEqual(full.coverage.status, "partial");
  // The verified live response still uses the older district label Eyüp.
  const observedLabels = allDistrictsPayload();
  observedLabels.pharmacies = observedLabels.pharmacies.map(row => row.district === "Eyüpsultan" ? { ...row, district: "Eyüp" } : row);
  assert.equal(normalizeIstanbulPharmacies(observedLabels, now).coverage.checkedDistricts, 39);
  const old = { ...turkpidyaFixture.pharmacies[1], duty_date: "2026-10-11", duty_start: "2026-10-11T19:00:00+03:00", duty_end: "2026-10-12T09:00:00+03:00" };
  const mixed = normalizeIstanbulPharmacies(turkpidyaPayload([turkpidyaFixture.pharmacies[0], old]), now);
  assert.equal(mixed.coverage.status, "partial");
  assert.equal(mixed.pharmacies.length, 1);
  assert.equal(mixed.pharmacies[0].dutyDate, istanbulDate);
  const empty = normalizeIstanbulPharmacies(turkpidyaPayload([]), now);
  assert.deepEqual(empty.pharmacies, []);
  assert.notEqual(empty.coverage.status, "complete");
});

test("İstanbul performs one fixed Turkpidya city request and limits shared caching to 300 seconds", async () => {
  let calls = 0;
  const { response, data } = await snapshot("istanbul", async (input, options) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://turkpidya.com");
    assert.equal(url.pathname, "/wp-json/turkpidya-data/v1/pharmacies/on-duty");
    assert.equal(url.searchParams.get("city"), "istanbul");
    assert.equal(url.searchParams.has("lat"), false);
    assert.equal(url.searchParams.has("lng"), false);
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.redirect, "error");
    return turkpidyaResponse(allDistrictsPayload());
  }, istanbulNow);
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.equal(data.dutyDateStatus, "verified");
  assert.equal(data.freshness.freshUntil, "2026-11-10T21:00:00.000Z");
  assert.equal(data.freshness.expiresAt, data.freshness.freshUntil);
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "public, must-revalidate, s-maxage=300");
  assert.equal(data.source.datasetUrl, turkpidyaFixture.attribution.url);
});

test("İstanbul honors shorter upstream lifetimes and Age without restarting freshness", async () => {
  const { response, data } = await snapshot("istanbul", async () => turkpidyaResponse(allDistrictsPayload(), {
    "Cache-Control": "public, must-revalidate, max-age=224, s-maxage=224", Age: "197",
  }), istanbulNow);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "public, must-revalidate, s-maxage=27");
  assert.equal(data.freshness.expiresAt, "2026-11-10T20:55:27.000Z");
  const later = await createPharmacyResponse("istanbul", async () => data, () => new Date("2026-11-10T20:55:20Z"));
  assert.equal(later.headers.get("vercel-cdn-cache-control"), "public, must-revalidate, s-maxage=7");
  const expired = await createPharmacyResponse("istanbul", async () => data, () => new Date("2026-11-10T20:55:27Z"));
  assert.equal(expired.status, 503);
  assert.deepEqual((await expired.json()).pharmacies, []);
  assert.equal(expired.headers.get("cache-control"), "no-store");
});

test("İstanbul hard expiry also stops a current-duty list at its provided duty end", async () => {
  const at = "2026-11-11T05:59:52.000Z";
  const payload = { ...allDistrictsPayload(), last_updated: "2026-11-11T08:55:00+03:00" };
  const { response, data } = await snapshot("istanbul", async () => turkpidyaResponse(payload), at);
  assert.equal(data.dutyDateStatus, "verified");
  assert.equal(data.freshness.expiresAt, "2026-11-11T06:00:00.000Z");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "public, must-revalidate, s-maxage=8");
});

test("İstanbul does not serve an upstream response whose positive lifetime is exhausted", async () => {
  const cases: Record<string, string>[] = [
    { "Cache-Control": "public, max-age=60", Age: "60" },
    { "Cache-Control": "no-cache, max-age=60", Age: "60" },
    { "Cache-Control": "private, max-age=60", Age: "61" },
    { "Cache-Control": "max-age=300", Date: "Tue, 10 Nov 2026 20:49:00 GMT" },
  ];
  for (const headers of cases) {
    const { response, data } = await snapshot("istanbul", async () => turkpidyaResponse(allDistrictsPayload(), headers), istanbulNow);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(data.pharmacies, []);
  }
});

test("İstanbul serves live-only upstream responses without cache reuse or failure fallback", async () => {
  for (const cacheControl of ["no-cache, max-age=300", "no-store", "private, max-age=300", "public, max-age=0"]) {
    let calls = 0;
    let failed = false;
    const now = () => new Date(istanbulNow);
    const loader = createPharmacyFeedLoader(async () => {
      calls++;
      return failed ? new Response(null, { status: 429, headers: { "Retry-After": "9" } })
        : turkpidyaResponse(allDistrictsPayload(), { "Cache-Control": cacheControl });
    }, now);
    // A successful live-only result must reject a cache callback, preventing the
    // framework from persisting it, while createPharmacyResponse serves its body.
    await assert.rejects(loader("istanbul"));
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await createPharmacyResponse("istanbul", loader, now);
      const data: PharmacyResponse = await response.json();
      assert.equal(response.status, 200, cacheControl);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
      assert.equal(response.headers.get("retry-after"), null);
      assert.equal(data.pharmacies.length, 39);
      assert.equal(data.dutyDateStatus, "verified");
      assert.equal(data.freshness.cacheUntil, null);
      assert.equal(data.freshness.expiresAt, "2026-11-10T21:00:00.000Z");
      assert.equal(getPharmacyFreshness(data, now().getTime()), "fresh");
    }
    assert.equal(calls, 3, "every live-only request fetches upstream again");
    failed = true;
    const failure = await createPharmacyResponse("istanbul", loader, now);
    assert.equal(failure.status, 503);
    assert.deepEqual((await failure.json()).pharmacies, []);
    assert.equal(failure.headers.get("retry-after"), "9");
    await createPharmacyResponse("istanbul", loader, now);
    assert.equal(calls, 4, "actual upstream failures still respect Retry-After");
  }
});

test("live-only presentation preserves shorter age, duty and verification boundaries", async () => {
  const { data: aged } = await snapshot("istanbul", async () => turkpidyaResponse(allDistrictsPayload(), {
    "Cache-Control": "no-cache, max-age=30", Age: "20",
  }), istanbulNow);
  assert.equal(aged.freshness.expiresAt, "2026-11-10T20:55:10.000Z");
  assert.equal(getPharmacyFreshness(aged, Date.parse(aged.freshness.expiresAt!)), "unavailable");
  const at = "2026-11-11T05:59:52.000Z";
  const payload = { ...allDistrictsPayload(), last_updated: "2026-11-11T08:55:00+03:00" };
  const { data: nearEnd } = await snapshot("istanbul", async () => turkpidyaResponse(payload, { "Cache-Control": "no-store" }), at);
  assert.equal(nearEnd.freshness.expiresAt, "2026-11-11T06:00:00.000Z");
  const unknown = { ...allDistrictsPayload(), last_updated: null };
  const { response, data: unverified } = await snapshot("istanbul", async () => turkpidyaResponse(unknown, { "Cache-Control": "no-store" }), istanbulNow);
  assert.equal(response.status, 200);
  assert.equal(unverified.dutyDateStatus, "unverified");
  assert.equal(unverified.freshness.statusAtFetch, "unknown");
  assert.equal(unverified.freshness.cacheUntil, null);
});

test("concurrent live-only requests each fetch their own response without recursive coalescing", async () => {
  for (const cacheControl of ["no-store", "no-cache", "private", "max-age=0"]) {
    let releaseFirst = () => {};
    const firstRequest = new Promise<void>(resolve => { releaseFirst = resolve; });
    let calls = 0;
    const now = () => new Date(istanbulNow);
    const loader = createPharmacyFeedLoader(async () => {
      const requestNumber = ++calls;
      if (requestNumber === 1) await firstRequest;
      const payload = allDistrictsPayload();
      payload.pharmacies[0].name = "REQUEST " + requestNumber;
      return turkpidyaResponse(payload, { "Cache-Control": cacheControl });
    }, now);
    const requests = Array.from({ length: 4 }, () => createPharmacyResponse("istanbul", loader, now));
    assert.equal(calls, 1, "requests initially wait for the same unknown cache policy");
    releaseFirst();
    const responses = await Promise.all(requests);
    const names = new Set<string>();
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const data: PharmacyResponse = await response.json();
      names.add(data.pharmacies[0].name);
    }
    assert.equal(calls, 4, "each request makes exactly one bounded upstream fetch");
    assert.equal(names.size, 4, "no live-only body is shared between callers");
  }
});

test("İstanbul reuses only unexpired validated snapshots and refreshes once at hard expiry", async () => {
  let calls = 0;
  let nowMs = Date.parse(istanbulNow);
  const now = () => new Date(nowMs);
  const loader = createPharmacyFeedLoader(async () => {
    calls++;
    return turkpidyaResponse(allDistrictsPayload(), { "Cache-Control": "max-age=30" });
  }, now);
  const first = await loader("istanbul");
  nowMs += 29000;
  assert.equal(await loader("istanbul"), first);
  assert.equal(calls, 1);
  nowMs += 1000;
  const refreshed = await Promise.all(Array.from({ length: 5 }, () => loader("istanbul")));
  assert.equal(calls, 2);
  assert.ok(refreshed.every(data => data === refreshed[0]));
  assert.notEqual(refreshed[0].lastSuccessfulFetchAt, first.lastSuccessfulFetchAt);
  assert.equal(refreshed[0].dutyDateStatus, "verified");
});

test("Turkpidya source state, missing update timestamps and future timestamps cannot confirm active duty", () => {
  const payload = turkpidyaPayload();
  for (const changed of [
    { ...payload, last_updated: null },
    { ...payload, last_updated: "2026-11-11T23:11:17+03:00" },
    { ...payload, pharmacies: payload.pharmacies.map(row => ({ ...row, source_state: "last_good" })) },
    { ...payload, pharmacies: payload.pharmacies.map(row => ({ ...row, duty_end: "2026-11-31T09:00:00+03:00" })) },
  ]) {
    assert.equal(normalizeIstanbulPharmacies(changed, new Date(istanbulNow)).schedule?.status, "unverified");
  }
});

test("İstanbul expired shared snapshots require refresh and failures cannot expose retained records", async () => {
  const { data: retained } = await snapshot("istanbul", async () => turkpidyaResponse(allDistrictsPayload()), istanbulNow);
  const before = JSON.stringify(retained);
  let refreshCalls = 0;
  const now = () => new Date("2026-11-10T21:01:00Z");
  const refresh = createPharmacyFeedLoader(async () => {
    refreshCalls++;
    return new Response("bad JSON");
  }, now);
  const response = await createPharmacyResponse("istanbul", city => loadPharmacyFeed(city, async () => retained, refresh, now), now);
  assert.equal(refreshCalls, 1);
  assert.equal(response.status, 503);
  assert.deepEqual((await response.json()).pharmacies, []);
  assert.equal(JSON.stringify(retained), before);
});

test("İstanbul coalesces warm refreshes, separates city caches, and honors 429 Retry-After", async () => {
  let calls = 0;
  let nowMs = Date.parse(istanbulNow);
  const now = () => new Date(nowMs);
  const loader = createPharmacyFeedLoader(async () => {
    calls++;
    return new Response(null, { status: 429, headers: { "Retry-After": "120" } });
  }, now);
  const responses = await Promise.all(Array.from({ length: 6 }, () => createPharmacyResponse("istanbul", loader, now)));
  assert.equal(calls, 1);
  assert.ok(responses.every(response => response.status === 503 && response.headers.get("retry-after") === "120"));
  await createPharmacyResponse("izmir", loader, now);
  assert.equal(calls, 2);
  nowMs += 90000;
  const cooldown = await createPharmacyResponse("istanbul", loader, now);
  assert.equal(calls, 2);
  assert.equal(cooldown.headers.get("retry-after"), "30");
  nowMs += 30000;
  await createPharmacyResponse("istanbul", loader, now);
  assert.equal(calls, 3);
});

test("İstanbul rejects malformed JSON, empty data and upstream failures with bounded retries", async () => {
  for (const status of [500, 503]) {
    let calls = 0;
    const { response, data } = await snapshot("istanbul", async () => {
      calls++;
      return new Response(null, { status });
    }, istanbulNow);
    assert.equal(calls, 2);
    assert.equal(response.status, 503);
    assert.deepEqual(data.pharmacies, []);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  let retryCalls = 0;
  const retry = await snapshot("istanbul", async () => {
    retryCalls++;
    return new Response(null, { status: 503, headers: { "Retry-After": "90" } });
  }, istanbulNow);
  assert.equal(retryCalls, 1);
  assert.equal(retry.response.headers.get("retry-after"), "90");
  for (const makeResponse of [() => new Response("not JSON"), () => Response.json({})]) {
    const { response, data } = await snapshot("istanbul", async () => makeResponse(), istanbulNow);
    assert.equal(response.status, 503);
    assert.deepEqual(data.pharmacies, []);
    assert.notEqual(data.coverage.status, "complete");
  }
  const empty = await snapshot("istanbul", async () => turkpidyaResponse(turkpidyaPayload([])), istanbulNow);
  assert.equal(empty.data.dutyDateStatus, "unverified");
  assert.equal(getPharmacyFreshness(empty.data, Date.parse(istanbulNow)), "unknown");
  assert.notEqual(empty.data.coverage.status, "complete");
  assert.deepEqual(empty.data.pharmacies, []);
});

test("uses a shared İzmir lifetime and recalculates CDN age against the original successful snapshot", async () => {
  const { response, data } = await snapshot("izmir", async () => Response.json([municipalRow]));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "public, s-maxage=900, stale-if-error=85500");
  assert.deepEqual(data.source, pharmacyCities.izmir.source);
  assert.equal(data.lastSuccessfulFetchAt, noon);
  assert.equal(data.dutyDateStatus, "reported-today");
  const age = await createPharmacyResponse("izmir", async () => data, () => new Date(day + "T12:10:00.000Z"));
  assert.equal(age.headers.get("vercel-cdn-cache-control"), "public, s-maxage=300, stale-if-error=85500");
});

test("midnight, overnight notes and the fallback expiry are independent of cache freshness", async () => {
  const { response, data } = await snapshot("izmir", async () => Response.json([municipalRow]), day + "T20:59:52.700Z");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "public, s-maxage=7, stale-if-error=86393");
  assert.equal(data.freshness.cacheUntil, day + "T21:14:52.700Z");
  assert.equal(data.freshness.freshUntil, day + "T21:00:00.000Z");
  assert.equal(getPharmacyFreshness(data, Date.parse(day + "T20:59:59.999Z")), "fresh");
  assert.equal(getPharmacyFreshness(data, Date.parse(day + "T21:00:00.000Z")), "stale");
  const retained = await createPharmacyResponse("izmir", async () => data, () => new Date(day + "T21:01:00.000Z"));
  assert.equal(retained.status, 200);
  const overnight = await retained.json();
  assert.equal(overnight.pharmacies[0].dutyNote, municipalRow.BolgeAciklama);
  assert.equal(overnight.dutyDateStatus, "outdated");
  const expired = await createPharmacyResponse("izmir", async () => data, () => new Date("2026-11-09T21:00:00.000Z"));
  assert.equal(expired.status, 503);
  assert.deepEqual((await expired.json()).pharmacies, []);
});

test("a current partial feed can replace an obsolete list at response time without changing the last-good cache", async () => {
  const { data: retained } = await snapshot("izmir", async () => Response.json([municipalRow]), day + "T20:59:52.700Z");
  const now = () => new Date(day + "T21:01:00.000Z");
  const nextDuty = { ...municipalRow, Tarih: "2026-11-09T08:00:00" };
  const refresh = createPharmacyFeedLoader(async () => Response.json([nextDuty, null]), now);
  const cached = async () => retained;
  const response = await createPharmacyResponse("izmir", city => loadPharmacyFeed(city, cached, refresh, now), now);
  const current = await response.json();
  assert.equal(response.status, 200);
  assert.equal(current.coverage.status, "partial");
  assert.equal(current.dutyDate, "2026-11-09");
  assert.equal(current.dutyDateStatus, "reported-today");
  assert.equal(retained.dutyDate, day);
  const sameDay = await loadPharmacyFeed("izmir", cached, async () => assert.fail("same-day cache should win"), () => new Date(noon));
  assert.equal(sameDay, retained);
});

test("mixed duty dates are never cacheable or treated as today's complete schedule", async () => {
  const other = { ...municipalRow, Adi: "Farklı Eczane", Tarih: "2026-11-07T09:00:00" };
  const { response, data } = await snapshot("izmir", async () => Response.json([municipalRow, other]));
  assert.equal(data.dutyDate, null);
  assert.equal(data.dutyDateStatus, "unverified");
  assert.equal(data.pharmacies.length, 2);
  assert.equal(getPharmacyFreshness(data, Date.parse(noon)), "stale");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
});

test("coalesces concurrent provider misses and never retries a 429 before Retry-After", async () => {
  let calls = 0;
  let nowMs = Date.parse(noon);
  const now = () => new Date(nowMs);
  const loader = createPharmacyFeedLoader(async () => {
    calls++;
    return new Response(null, { status: 429, headers: { "Retry-After": "120" } });
  }, now);
  const first = await Promise.all(Array.from({ length: 6 }, () => createPharmacyResponse("izmir", loader, now)));
  assert.equal(calls, 1);
  assert.ok(first.every(response => response.status === 503 && response.headers.get("retry-after") === "120"));
  nowMs += 90000;
  const cooled = await createPharmacyResponse("izmir", loader, now);
  assert.equal(calls, 1);
  assert.equal(cooled.headers.get("retry-after"), "30");
  assert.equal((await cooled.json()).unavailableReason, "rate-limited");
  nowMs += 30000;
  await createPharmacyResponse("izmir", loader, now);
  assert.equal(calls, 2);
  assert.equal(retryAfterSeconds("Sun, 08 Nov 2026 12:02:00 GMT", Date.parse(noon)), 120);
});

test("a transient 5xx retries once with bounded, fixed upstream options", async () => {
  let calls = 0;
  const { response } = await snapshot("izmir", async (url, options) => {
    assert.equal(url, pharmacyCities.izmir.source.url);
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal instanceof AbortSignal);
    return ++calls === 1 ? new Response(null, { status: 502 }) : Response.json([municipalRow]);
  });
  assert.equal(calls, 2);
  assert.equal(response.status, 200);
});

test("the İstanbul per-call timeout aborts the request and returns a safe cold-cache failure", async () => {
  let calls = 0;
  const { response, data } = await snapshot("istanbul", async (_input, options) => {
    calls++;
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout did not abort the request")), 6500);
      options?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("provider private details", "TimeoutError"));
      }, { once: true });
    });
  }, istanbulNow);
  assert.equal(calls, 1);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
  assert.doesNotMatch(JSON.stringify(data), /private details/);
  assert.deepEqual(data.pharmacies, []);
});

test("malformed, empty, oversized and unusable responses cannot replace a usable cache response", async () => {
  const failures = [
    new Response("bad JSON"), Response.json({ rows: [municipalRow] }),
    Response.json([]), Response.json([{ Adi: "", Tarih: municipalRow.Tarih }]),
    new Response("x".repeat(1024 * 1024 + 1)),
  ];
  for (const failure of failures) {
    const { response, data } = await snapshot("izmir", async () => failure);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(data.lastSuccessfulFetchAt, null);
    assert.equal(getPharmacyFreshness(data, Date.parse(noon)), "unavailable");
  }
});

test("search folds Turkish spellings and ranks only usable coordinates by straight-line distance", () => {
  const pharmacies = normalizeIzmirPharmacies([
    municipalRow,
    { ...municipalRow, Adi: "IŞIK ECZANESİ", Bolge: "ÇİĞLİ", Adres: "ATAŞEHİR MAH. 1 SK.", LokasyonX: 38.52, LokasyonY: 27.08 },
    { ...municipalRow, Adi: "Konumsuz", Adres: null, Bolge: null, LokasyonX: null },
  ]).pharmacies;
  for (const query of ["YENİ tuncay", "altindag TUNA", "fazıl paşa", "KOŞUKAVAK"]) {
    assert.deepEqual(filterPharmacies(pharmacies, query), [pharmacies[0]]);
  }
  for (const query of ["ışık çiğli", "ISIK CIGLI", "Atasehir"]) {
    assert.deepEqual(filterPharmacies(pharmacies, query), [pharmacies[1]]);
  }
  const ranked = rankPharmacies(pharmacies, [27.08, 38.52]);
  assert.equal(ranked[0].pharmacy.name, "IŞIK ECZANESİ");
  assert.equal(ranked[0].distance, 0);
  assert.equal(ranked[2].distance, null);
  assert.ok(Math.abs(distanceKm([27.1, 38.4], [27.1, 39.4]) - 111.195) < 0.001);
  assert.ok(Math.abs(distanceKm([0, 0], [180, 0]) - 20015.087) < 0.001);
});

test("matches both provinces, Adalar and a near-boundary position without accepting unrelated cities", () => {
  const cases: [Coordinates, PharmacyCity][] = [
    [[27.1428, 38.4237], "izmir"], [[26.77, 38.32], "izmir"],
    [[28.9784, 41.037], "istanbul"], [[29.12, 40.858], "istanbul"],
  ];
  for (const [coordinates, city] of cases) {
    const location = locatePharmacyCity(coordinates, 1500);
    assert.equal(location?.city, city);
    assert.equal(location?.accuracy, 1500);
  }
  assert.equal(locatePharmacyCity([29.67, 41.174], 100)?.nearBoundary, true);
  assert.equal(locatePharmacyCity([29.33, 40.82], 1500), null);
  assert.equal(locatePharmacyCity([32.86, 39.92], 150000), null);
  assert.equal(locatePharmacyCity([NaN, 0], null), null);
  assert.match(geolocationError(1), /izni/);
  assert.match(geolocationError(3), /zaman aşımı/);
});

test("generates destination-only coordinate URLs for both map apps", () => {
  const { google, apple } = navigationLinks([29.076084, 40.978016]);
  assert.equal(new URL(google).searchParams.get("destination"), "40.978016,29.076084");
  assert.equal(new URL(google).searchParams.get("dir_action"), "navigate");
  assert.equal(new URL(google).searchParams.has("origin"), false);
  assert.equal(new URL(apple).pathname, "/directions");
  assert.equal(new URL(apple).searchParams.get("destination"), "40.978016,29.076084");
  assert.equal(new URL(apple).searchParams.has("source"), false);
});
