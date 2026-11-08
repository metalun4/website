import assert from "node:assert/strict";
import { test } from "node:test";
import { createPharmacyResponse, normalizePharmacies } from "../src/lib/pharmacy-feed";
import { distanceKm, filterPharmacies, getPharmacyFreshness, pharmacySource, type PharmacyResponse } from "../src/lib/pharmacies";

// Representative row from the municipality feed, including its reused ID and local timestamp.
const municipalityRow = {
  Tarih: "2026-11-08T08:00:00",
  LokasyonY: "27.192712",
  LokasyonX: "38.428346",
  BolgeAciklama: "24:00DEN SONRA- ÇAMDİBİ",
  Adi: "YENİ TUNCAY ECZANESİ",
  Telefon: "02324356177",
  Adres: "TUNA MAH. FAZIL PAŞA CAD. NO:35/A KOŞUKAVAK",
  BolgeId: 4,
  Bolge: "ALTINDAĞ",
  UzaklikMetre: null,
  EczaneId: -1,
  IlceId: 0,
};

async function snapshot(records: unknown, at: string) {
  const response = await createPharmacyResponse(async () => Response.json(records), () => new Date(at));
  const data: PharmacyResponse = await response.json();
  return { response, data };
}

test("normalizes the observed feed fields, deduplicates rows and creates distinct IDs", () => {
  const other = { ...municipalityRow, Adi: "YENİ GÖKSEN ECZANESİ", Bolge: "BALÇOVA" };
  const [pharmacy, second] = normalizePharmacies([municipalityRow, municipalityRow, other]);
  assert.deepEqual(pharmacy, {
    id: pharmacy.id,
    name: "YENİ TUNCAY ECZANESİ",
    address: "TUNA MAH. FAZIL PAŞA CAD. NO:35/A KOŞUKAVAK",
    region: "ALTINDAĞ",
    phone: "02324356177",
    dialNumber: "+902324356177",
    dutyDate: "2026-11-08",
    dutyNote: "24:00DEN SONRA- ÇAMDİBİ",
    coordinates: [27.192712, 38.428346],
  });
  assert.notEqual(pharmacy.id, second.id);
  assert.equal(normalizePharmacies([other, municipalityRow])[1].id, pharmacy.id);
});

test("excludes invalid coordinates from the map and preserves contact information", () => {
  const pairs = [
    ["27.192712", "38.428346"], ["0", "0"], ["", "27.1"], [null, "27.1"],
    [38.4, Infinity], [38.4, "27.1x"], [38.4, "0x1b"], [38.4, "27.1,2"], [41, 29],
  ];
  for (const [LokasyonX, LokasyonY] of pairs) {
    const [pharmacy] = normalizePharmacies([{ ...municipalityRow, LokasyonX, LokasyonY }]);
    assert.equal(pharmacy.coordinates, null);
    assert.equal(pharmacy.dialNumber, "+902324356177");
  }
  assert.deepEqual(normalizePharmacies([{ ...municipalityRow, LokasyonX: " 38,428346 ", LokasyonY: 27.192712 }])[0].coordinates,
    [27.192712, 38.428346]);
});

test("skips unidentifiable records and retains explicitly missing or non-dialable fields", () => {
  const incomplete = { Adi: "  Şirinyer   Eczanesi ", Tarih: "2028-02-29T08:00:00.123" };
  const pharmacies = normalizePharmacies([
    null, 5, [], {}, { ...municipalityRow, Adi: " " },
    { ...municipalityRow, Tarih: "2026-02-29T08:00:00" },
    { ...municipalityRow, Tarih: "2026-11-08T24:00:00" },
    { ...municipalityRow, Tarih: "08/11/2026" },
    incomplete,
    { ...municipalityRow, Telefon: "numara değişti", Adres: 10 },
    { ...municipalityRow, Telefon: "(0232) 435 61 77" },
  ]);
  assert.equal(pharmacies.length, 3);
  assert.deepEqual(pharmacies[0], {
    id: pharmacies[0].id, name: "Şirinyer Eczanesi", dutyDate: "2028-02-29",
    region: null, address: null, phone: null, dialNumber: null, dutyNote: null, coordinates: null,
  });
  assert.equal(pharmacies[1].phone, "numara değişti");
  assert.equal(pharmacies[1].dialNumber, null);
  assert.equal(pharmacies[1].address, null);
  assert.equal(pharmacies[2].dialNumber, "+902324356177");
});

test("sets a shared 15-minute response lifetime with a bounded stale-on-error policy", async () => {
  const at = "2026-11-08T15:00:00.000Z";
  const { response, data } = await snapshot([municipalityRow], at);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "public, s-maxage=900, stale-if-error=86400");
  assert.deepEqual(data.source, pharmacySource);
  assert.equal(data.lastSuccessfulFetchAt, at);
  assert.equal(data.freshness.timeZone, "Europe/Istanbul");
  assert.equal(data.freshness.freshUntil, "2026-11-08T15:15:00.000Z");
  assert.equal(getPharmacyFreshness(data, Date.parse("2026-11-08T15:14:59.999Z")), "fresh");
  assert.equal(getPharmacyFreshness(data, Date.parse("2026-11-08T15:15:00.000Z")), "stale");
});

test("expires today's list at Istanbul midnight and keeps an overnight note on yesterday's list", async () => {
  const { response, data } = await snapshot([municipalityRow], "2026-11-08T20:59:52.700Z");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), "public, s-maxage=7, stale-if-error=86400");
  assert.equal(data.freshness.freshUntil, "2026-11-08T21:00:00.000Z");
  assert.equal(getPharmacyFreshness(data, Date.parse("2026-11-08T20:59:59.999Z")), "fresh");
  assert.equal(getPharmacyFreshness(data, Date.parse("2026-11-08T21:00:00.000Z")), "stale");

  const overnight = await snapshot([municipalityRow], "2026-11-08T21:01:00.000Z");
  assert.equal(overnight.data.dutyDate, "2026-11-08");
  assert.equal(overnight.data.freshness.statusAtFetch, "stale");
  assert.equal(overnight.data.freshness.freshUntil, null);
  assert.equal(overnight.data.pharmacies[0].dutyNote, municipalityRow.BolgeAciklama);
});

test("uses the Istanbul date even before UTC midnight at a year boundary", async () => {
  const nextYear = { ...municipalityRow, Tarih: "2027-01-01T08:00:00" };
  const { data } = await snapshot([nextYear], "2026-12-31T21:00:00.000Z");
  assert.equal(data.dutyDate, "2027-01-01");
  assert.equal(data.freshness.statusAtFetch, "fresh");
  const future = await snapshot([nextYear], "2026-12-31T20:59:00.000Z");
  assert.equal(future.data.freshness.statusAtFetch, "stale");
  const mixed = await snapshot([nextYear, municipalityRow], "2026-12-31T21:00:00.000Z");
  assert.equal(mixed.data.dutyDate, null);
  assert.equal(mixed.data.freshness.statusAtFetch, "stale");
  assert.equal(mixed.data.pharmacies.length, 2);
});

test("uses a bounded uncached upstream request and returns a safe cold-cache failure", async () => {
  let called = false;
  const response = await createPharmacyResponse(async (url, options) => {
    called = true;
    assert.equal(url, pharmacySource.url);
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal instanceof AbortSignal);
    throw new DOMException("private error details", "TimeoutError");
  });
  assert.equal(called, true);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
  const body = await response.text();
  assert.doesNotMatch(body, /private error details/);
  const data: PharmacyResponse = JSON.parse(body);
  assert.equal(data.lastSuccessfulFetchAt, null);
  assert.equal(getPharmacyFreshness(data, Date.now()), "unavailable");
  assert.deepEqual(data.pharmacies, []);
});

test("HTTP errors, malformed payloads and empty lists cannot replace a usable cache response", async () => {
  const failures = [
    new Response("bad gateway", { status: 502 }),
    new Response("bad JSON"),
    Response.json({ rows: [municipalityRow] }),
    Response.json([]),
    Response.json([{ Adi: "  ", Tarih: municipalityRow.Tarih }]),
  ];
  for (const failure of failures) {
    const response = await createPharmacyResponse(async () => failure);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
    assert.equal((await response.json()).freshness.statusAtFetch, "unavailable");
  }
});

test("searches names, regions and addresses with Turkish and ASCII spellings", () => {
  const pharmacies = normalizePharmacies([
    municipalityRow,
    { ...municipalityRow, Adi: "IŞIK ECZANESİ", Bolge: "ÇİĞLİ", Adres: "ATAŞEHİR MAH. 1 SK." },
  ]);
  for (const query of ["YENİ tuncay", "altindag TUNA", "fazıl paşa", "KOŞUKAVAK"]) {
    assert.deepEqual(filterPharmacies(pharmacies, query), [pharmacies[0]]);
  }
  for (const query of ["ışık çiğli", "ISIK CIGLI", "Atasehir"]) {
    assert.deepEqual(filterPharmacies(pharmacies, query), [pharmacies[1]]);
  }
  assert.deepEqual(filterPharmacies(pharmacies, "bulunmayan"), []);
  assert.equal(filterPharmacies(pharmacies, "  "), pharmacies);
});

test("computes symmetric straight-line distances in kilometres", () => {
  assert.equal(distanceKm([27.1, 38.4], [27.1, 38.4]), 0);
  assert.ok(Math.abs(distanceKm([27.1, 38.4], [27.1, 39.4]) - 111.195) < 0.001);
  assert.ok(Math.abs(distanceKm([0, 0], [180, 0]) - 20015.087) < 0.001);
  const forward = distanceKm([27.1, 38.4], [27.2, 38.5]);
  const reverse = distanceKm([27.2, 38.5], [27.1, 38.4]);
  assert.ok(Math.abs(forward - reverse) < 1e-10);
});
