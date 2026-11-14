import { expect, test, type Page } from "@playwright/test";
import { pharmacyCities, type PharmacyCity } from "../src/lib/pharmacy-cities";
import { istanbulDay, type Coordinates, type Pharmacy, type PharmacyResponse } from "../src/lib/pharmacies";

const path = "/nobetci-eczaneler";
const canonical = "https://aydemir.website" + path;
const izmir: Coordinates = [27.1428, 38.4237];
const istanbul: Coordinates = [28.9784, 41.037];
const istanbulTitle = "İstanbul Nöbetçi Eczaneler | En Yakın Eczaneyi Haritadan Bul";

function fixture(city: PharmacyCity, pharmacies: Partial<Pharmacy>[], fetched = new Date()): PharmacyResponse {
  const { date, midnight } = istanbulDay(fetched);
  const cacheUntil = fetched.getTime() + pharmacyCities[city].cacheSeconds * 1000;
  const izmirFeed = city === "izmir";
  return {
    city,
    source: pharmacyCities[city].source,
    dutyDate: date,
    dutyDateStatus: izmirFeed ? "reported-today" : "verified",
    lastSuccessfulFetchAt: fetched.toISOString(),
    freshness: {
      timeZone: "Europe/Istanbul",
      statusAtFetch: "fresh",
      cacheUntil: new Date(cacheUntil).toISOString(),
      freshUntil: new Date(izmirFeed ? Math.min(cacheUntil, midnight) : cacheUntil).toISOString(),
      expiresAt: new Date(izmirFeed ? fetched.getTime() + 86400000 : cacheUntil).toISOString(),
    },
    coverage: { status: "complete" },
    pharmacies: pharmacies.map((record, index) => ({
      id: city + ":test:" + index, name: "Deneme Eczanesi", city, region: city === "izmir" ? "Konak" : "Beyoğlu",
      address: "Deneme Mahallesi, 12. Sokak", phone: "02321234567", dialNumber: "+902321234567",
      dutyDate: date, dutyNote: null, coordinates: city === "izmir" ? izmir : istanbul,
      ...record,
    })),
  };
}

async function mockBasemap(page: Page) {
  await page.route("https://tiles.openfreemap.org/styles/*", route => route.fulfill({
    json: {
      version: 8,
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sources: {},
      layers: [{
        id: "background", type: "background",
        paint: { "background-color": route.request().url().endsWith("/fiord") ? "#1c2530" : "#e8e9e4" },
      }],
    },
  }));
  await page.route("https://tiles.openfreemap.org/fonts/**", route => route.fulfill({ status: 200, body: "" }));
}

async function mockFeeds(page: Page, feeds: Partial<Record<PharmacyCity, PharmacyResponse>>) {
  const requests: string[] = [];
  await page.route("**/api/nobetci-eczaneler/*", route => {
    const city = new URL(route.request().url()).pathname.split("/").at(-1) as PharmacyCity;
    requests.push(city);
    const feed = feeds[city];
    return feed ? route.fulfill({ json: feed }) : route.fulfill({ status: 503, body: "" });
  });
  return requests;
}

function locateButton(page: Page) {
  return page.getByRole("button", { name: "Yakınımdaki Eczaneleri Bul" });
}

test.describe("server-rendered discovery pages", () => {
  test.use({ javaScriptEnabled: false });

  test("publishes distinct Turkish city pages, canonical metadata and crawlable city links", async ({ page, request }) => {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nöbetçi Eczane Bul");
    await expect(page.locator(".pharmacy-page")).toHaveAttribute("lang", "tr");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    await expect(page.getByRole("link", { name: "İzmir", exact: true })).toHaveAttribute("href", path + "/izmir");
    await expect(page.getByRole("link", { name: "İstanbul", exact: true })).toHaveAttribute("href", path + "/istanbul");
    await page.getByRole("link", { name: "İstanbul", exact: true }).click();
    await expect(page).toHaveTitle(istanbulTitle);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("İstanbul Nöbetçi Eczaneler");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical + "/istanbul");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", pharmacyCities.istanbul.description);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", istanbulTitle);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "tr_TR");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(jsonLd!)).toMatchObject({
      "@type": "WebApplication", inLanguage: "tr", isAccessibleForFree: true, url: canonical + "/istanbul",
    });
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>" + canonical + "/istanbul</loc>");
    expect(sitemap).toContain("<loc>" + canonical + "/izmir</loc>");
    expect((await request.get(path + "/ankara")).status()).toBe(404);
    expect((await request.get("/api" + path + "/ankara")).status()).toBe(404);
    expect((await request.get("/api" + path + "/izmir?lat=38.4")).status()).toBe(400);
    await expect(page.getByRole("link", { name: "Turkpidya", exact: true })).toHaveAttribute("href", pharmacyCities.istanbul.source.datasetUrl);
    await expect(page.getByRole("link", { name: "İstanbul Eczacı Odası nöbet listesi", exact: true })).toBeVisible();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test("starts without requesting location or a feed, then ranks nearby results and opens destination-only actions", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ longitude: izmir[0], latitude: izmir[1], accuracy: 45 });
  await page.addInitScript(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (...args) => {
      document.documentElement.dataset.gpsRequested = "yes";
      original(...args);
    };
  });
  await mockBasemap(page);
  const requests = await mockFeeds(page, {
    izmir: fixture("izmir", [
      { name: "Sahil Eczanesi", coordinates: [27.23, 38.435] },
      { name: "Merkez Eczanesi" },
      { name: "Işık Eczanesi", region: "Çiğli", coordinates: [27.09, 38.50] },
      { name: "Özgür Eczanesi", coordinates: [27.15, 38.425] },
      { name: "Uzak Eczane", coordinates: [27.29, 38.54] },
      { name: "Konumu Eksik Eczane", coordinates: null },
    ]),
  });
  await page.goto(path);
  await expect(locateButton(page)).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-gps-requested", "yes");
  expect(requests).toEqual([]);
  await locateButton(page).click();
  await expect(page).toHaveURL(path + "/izmir");
  await expect(page.getByText("Konumunuz · ±45 m")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Yakındaki eczaneler" })).toBeVisible();
  await expect(page.getByText("Kuş uçuşu mesafeye göre sıralandı")).toBeVisible();
  const nearby = page.locator(".pharmacy-nearby-list > li");
  await expect(nearby).toHaveCount(4);
  await expect(nearby.first()).toContainText("Merkez Eczanesi");
  await expect(nearby.first().getByRole("link", { name: /^Ara/ })).toHaveAttribute("href", "tel:+902321234567");
  const href = await nearby.first().getByRole("link", { name: /^Yol tarifi/ }).getAttribute("href");
  const google = new URL(href!);
  expect(google.searchParams.get("destination")).toBe("38.4237,27.1428");
  expect(google.searchParams.get("origin")).toBeNull();
  await nearby.first().getByRole("button", { name: /Merkez Eczanesi/ }).press("Enter");
  const detail = page.getByRole("heading", { name: "Merkez Eczanesi" });
  await expect(detail).toBeFocused();
  const apple = new URL((await page.getByRole("link", { name: /Apple Haritalar/ }).getAttribute("href"))!);
  expect(apple.origin).toBe("https://maps.apple.com");
  expect(apple.searchParams.get("destination")).toBe("38.4237,27.1428");
  await page.getByRole("button", { name: "Eczane ayrıntılarını kapat" }).press("Enter");
  await expect(nearby.first().getByRole("button", { name: /Merkez Eczanesi/ })).toBeFocused();
  await page.getByText("Tüm eczaneler", { exact: false }).click();
  await expect(page.getByRole("button", { name: /Konumu Eksik Eczane/ })).toBeVisible();
  const search = page.getByRole("searchbox");
  await search.fill("isIk cigli");
  await expect(page.locator(".pharmacy-nearby-list > li")).toHaveCount(1);
  await expect(page.locator(".pharmacy-nearby-list")).toContainText("Işık Eczanesi");
  expect(requests).toEqual(["izmir"]);
});

test("moves between supported cities and reports low GPS accuracy", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ longitude: istanbul[0], latitude: istanbul[1], accuracy: 1300 });
  await mockBasemap(page);
  const requests = await mockFeeds(page, {
    izmir: fixture("izmir", [{ name: "Konak Eczanesi" }]),
    istanbul: fixture("istanbul", [{ name: "Beyoğlu Eczanesi" }]),
  });
  await page.goto(path + "/izmir");
  await expect(page.getByRole("button", { name: /Konak Eczanesi/ })).toBeVisible();
  await locateButton(page).click();
  await expect(page).toHaveURL(path + "/istanbul");
  await expect(page.getByText("Yaklaşık konum · ±1,3 km")).toBeVisible();
  await expect(page.locator(".pharmacy-nearby-list")).toContainText("Beyoğlu Eczanesi");
  await expect(page.getByRole("link", { name: "İstanbul", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "İzmir", exact: true }).click();
  await expect(page).toHaveURL(path + "/izmir");
  await expect(page.getByRole("button", { name: /Konak Eczanesi/ })).toBeVisible();
  expect(requests).toEqual(["izmir", "istanbul"]);
});

test("finds İstanbul pharmacies by either spelling of Eyüpsultan", async ({ page }) => {
  await mockBasemap(page);
  await mockFeeds(page, {
    istanbul: fixture("istanbul", [
      { name: "Feshane Eczanesi", region: "Eyüp", address: "Feshane Caddesi" },
      { name: "Moda Eczanesi", region: "Kadıköy" },
    ]),
  });
  await page.goto(path + "/istanbul");
  const names = page.locator(".pharmacy-result-name strong");
  await expect(names).toHaveCount(2);
  const search = page.getByRole("searchbox");
  await search.fill("Eyüpsultan Feshane");
  await expect(names).toHaveText(["Feshane Eczanesi"]);
  await search.fill("eyup");
  await expect(names).toHaveText(["Feshane Eczanesi"]);
  await expect(page.locator(".pharmacy-result-name > span")).toHaveText(["Eyüp"]);
});

for (const [code, message] of [[1, /Konum izni verilmedi/], [2, /Konumunuz alınamadı/], [3, /zaman aşımına uğradı/]] as const) {
  test("keeps manual discovery available after geolocation error " + code, async ({ page }) => {
    await page.addInitScript(code => {
      navigator.geolocation.getCurrentPosition = (_success, failure) => {
        failure?.({ code, message: "", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
      };
    }, code);
    await mockBasemap(page);
    const requests = await mockFeeds(page, {});
    await page.goto(path);
    await locateButton(page).click();
    await expect(page.getByText(message)).toBeVisible();
    await expect(page.getByRole("link", { name: "İzmir", exact: true })).toBeVisible();
    expect(requests).toEqual([]);
  });
}

test("reports an unsupported location and never sends coordinates in a feed request", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 39.92, longitude: 32.86, accuracy: 10 });
  await mockBasemap(page);
  const requests = await mockFeeds(page, {});
  await page.goto(path);
  await locateButton(page).click();
  await expect(page.getByText(/Bu konum için liste bulunmuyor/)).toBeVisible();
  await expect(page).toHaveURL(path);
  expect(requests).toEqual([]);
});

test("selects a marker and a manual map location, and keeps the canvas through theme and city switches", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await mockBasemap(page);
  await mockFeeds(page, {
    izmir: fixture("izmir", [{ name: "Merkez Eczanesi" }]),
    istanbul: fixture("istanbul", [{ name: "Beyoğlu Eczanesi" }]),
  });
  await page.goto(path + "/izmir");
  const map = page.locator(".pharmacy-map");
  const canvas = page.locator(".maplibregl-canvas");
  await expect(map).toHaveAttribute("data-map-state", "ready", { timeout: 15000 });
  await expect(page.getByRole("button", { name: /Merkez Eczanesi/ })).toBeVisible();
  await canvas.evaluate(element => element.setAttribute("data-preserved", "true"));
  await expect(async () => {
    await canvas.click();
    await expect(page.getByRole("heading", { name: "Merkez Eczanesi" })).toBeFocused({ timeout: 1000 });
  }).toPass({ timeout: 8000 });
  await page.getByRole("button", { name: "Eczane ayrıntılarını kapat" }).click();
  await page.getByRole("button", { name: "Haritadan konum seç" }).press("Enter");
  const confirm = page.getByRole("button", { name: "Bu bölgede ara" });
  await expect(confirm).toBeFocused();
  await confirm.press("Enter");
  await expect(page.getByText("Haritadan seçilen nokta")).toBeVisible();
  await expect(page.locator(".pharmacy-nearby-list")).toContainText("Merkez Eczanesi");
  await page.getByRole("link", { name: "İstanbul", exact: true }).click();
  await expect(page).toHaveURL(path + "/istanbul");
  await expect(canvas).toHaveAttribute("data-preserved", "true");
  const darkStyle = page.waitForRequest("https://tiles.openfreemap.org/styles/fiord");
  await page.emulateMedia({ colorScheme: "dark" });
  await darkStyle;
  await expect(map).toHaveAttribute("data-map-state", "ready");
  await expect(canvas).toHaveAttribute("data-preserved", "true");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(28, 28, 28)");
});

for (const city of ["izmir", "istanbul"] as const) {
  test(`fits the map to the GPS results after clearing a distant ${city} search`, async ({ page, context }) => {
    const origin = city === "izmir" ? izmir : istanbul;
    await page.emulateMedia({ reducedMotion: "reduce" });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ longitude: origin[0], latitude: origin[1], accuracy: 25 });
    await mockBasemap(page);
    await mockFeeds(page, {
      [city]: fixture(city, [
        { name: "Merkez Eczanesi" },
        { name: "Birinci Yakın Eczane", coordinates: [origin[0] + 0.001, origin[1]] },
        { name: "İkinci Yakın Eczane", coordinates: [origin[0] + 0.002, origin[1]] },
        { name: "Üçüncü Yakın Eczane", coordinates: [origin[0] + 0.003, origin[1]] },
        { name: "Uzak Eczane", coordinates: [origin[0] + 0.42, origin[1] + 0.02] },
      ]),
    });
    await page.goto(path + "/" + city);
    const picker = page.getByRole("button", { name: "Haritadan konum seç" });
    await expect(picker).toBeEnabled({ timeout: 15000 });
    await page.getByRole("searchbox").fill("Uzak Eczane");
    await expect(page.locator(".pharmacy-result-name strong")).toHaveText(["Uzak Eczane"]);
    await locateButton(page).click();
    const nearby = page.locator(".pharmacy-nearby-list");
    await expect(nearby.locator(".pharmacy-result-name strong").first()).toHaveText("Merkez Eczanesi");

    // Pick the displayed map center to measure where the GPS fit actually landed.
    await picker.click();
    await page.getByRole("button", { name: "Bu bölgede ara" }).click();
    await expect(page.getByText("Haritadan seçilen nokta")).toBeVisible();
    await expect(nearby.locator(".pharmacy-distance").first()).toHaveText(/^\d{1,3} m$/);
  });
}

test("exits manual map picking on city navigation and successful GPS", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ longitude: istanbul[0], latitude: istanbul[1], accuracy: 25 });
  await mockBasemap(page);
  await mockFeeds(page, {
    izmir: fixture("izmir", [{ name: "Konak Eczanesi" }]),
    istanbul: fixture("istanbul", [{ name: "Beyoğlu Eczanesi" }]),
  });
  await page.goto(path + "/izmir");
  const picker = page.getByRole("button", { name: "Haritadan konum seç" });
  const confirm = page.getByRole("button", { name: "Bu bölgede ara" });
  await expect(picker).toBeEnabled({ timeout: 15000 });
  await picker.click();
  await expect(confirm).toBeVisible();
  await page.getByRole("link", { name: "İstanbul", exact: true }).click();
  await expect(page).toHaveURL(path + "/istanbul");
  await expect(confirm).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(path + "/izmir");
  await expect(confirm).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(path + "/istanbul");
  await picker.click();
  await locateButton(page).click();
  await expect(page.getByText("Konumunuz · ±25 m")).toBeVisible();
  await expect(confirm).toHaveCount(0);
  await expect(async () => {
    await page.locator(".maplibregl-canvas").click();
    await expect(page.getByRole("heading", { name: "Beyoğlu Eczanesi" })).toBeFocused({ timeout: 1000 });
  }).toPass({ timeout: 8000 });
  await expect(page.getByText("Konumunuz · ±25 m")).toBeVisible();
});

test("shows a retained manual origin beside a GPS permission error", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, failure) => {
      failure?.({ code: 1, message: "", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    };
  });
  await mockBasemap(page);
  await mockFeeds(page, { izmir: fixture("izmir", [{ name: "Konak Eczanesi" }]) });
  await page.goto(path + "/izmir");
  const picker = page.getByRole("button", { name: "Haritadan konum seç" });
  await expect(picker).toBeEnabled({ timeout: 15000 });
  await picker.click();
  await page.getByRole("button", { name: "Bu bölgede ara" }).click();
  await expect(page.getByText("Haritadan seçilen nokta")).toBeVisible();
  await locateButton(page).click();
  await expect(page.getByText(/Konum izni verilmedi/)).toBeVisible();
  await expect(page.getByText("Haritadan seçilen nokta")).toBeVisible();
  await expect(page.locator(".pharmacy-nearby-list")).toContainText("Konak Eczanesi");
});

test("keeps keyboard-accessible pharmacy details available when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply: (getContext, canvas, args) => String(args[0]).includes("webgl") ? null : Reflect.apply(getContext, canvas, args),
    });
  });
  await mockBasemap(page);
  await mockFeeds(page, { istanbul: fixture("istanbul", [{ name: "Beyoğlu Eczanesi" }]) });
  await page.goto(path + "/istanbul");
  await expect(page.getByText("Harita açılamadı. Eczaneleri listeden inceleyebilirsiniz.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Haritadan konum seç" })).toBeDisabled();
  await page.getByRole("button", { name: /Beyoğlu Eczanesi/ }).press("Enter");
  await expect(page.getByRole("heading", { name: "Beyoğlu Eczanesi" })).toBeFocused();
  await expect(page.getByRole("link", { name: /^Yol tarifi/ })).toBeVisible();
});

test("handles loading, obsolete dates, retry cooldown and the İstanbul official list link", async ({ page }) => {
  await mockBasemap(page);
  const data: PharmacyResponse = {
    ...fixture("istanbul", []),
    dutyDate: "2026-10-11", dutyDateStatus: "outdated", lastSuccessfulFetchAt: null,
    freshness: { timeZone: "Europe/Istanbul", statusAtFetch: "unavailable", cacheUntil: null, freshUntil: null, expiresAt: null },
    unavailableReason: "outdated", coverage: { status: "unknown" },
  };
  let unblock: () => void = () => {};
  const gate = new Promise<void>(resolve => { unblock = resolve; });
  await page.route("**/api/nobetci-eczaneler/istanbul", async route => {
    await gate;
    await route.fulfill({ status: 503, headers: { "Retry-After": "60" }, json: data });
  });
  await page.goto(path + "/istanbul");
  await expect(page.getByText("Nöbet listesi yükleniyor…")).toBeVisible();
  unblock();
  await expect(page.getByText("Güncel nöbet listesine ulaşılamadı.")).toBeVisible();
  await expect(page.getByText("Kaynağın bildirdiği tarih 11 Ekim 2026.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yenileme beklemede" })).toBeDisabled();
  await expect(page.getByRole("link", { name: /İstanbul Eczacı Odası/ })).toHaveAttribute("href", pharmacyCities.istanbul.source.officialListUrl);
  await expect(page.getByRole("link", { name: "Turkpidya", exact: true })).toHaveAttribute("href", pharmacyCities.istanbul.source.datasetUrl);
});

test("uses the server response age when a browser clock runs behind", async ({ page }) => {
  const time = new Date("2026-11-08T12:00:00Z");
  await page.clock.setFixedTime(new Date("2026-11-08T12:04:00Z"));
  await mockBasemap(page);
  await page.route("**/api/nobetci-eczaneler/izmir", route => route.fulfill({
    headers: { Date: "Sun, 08 Nov 2026 12:10:00 GMT", Age: "300" },
    json: fixture("izmir", [{ name: "Önceki Sonuç Eczanesi" }], time),
  }));
  await page.goto(path + "/izmir");
  await expect(page.getByText("Listenin güncelliği doğrulanamadı.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Önceki Sonuç Eczanesi/ })).toBeVisible();
});

for (const city of ["izmir", "istanbul"] as const) {
  test(`keeps expired ${city} records hidden after a failed refresh with a slow device clock`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-10T19:50:00Z") });
    await mockBasemap(page);
    const receivedAt = new Date("2026-11-10T20:59:54Z");
    const expiry = "2026-11-10T21:00:00.000Z";
    const data = fixture(city, [{ name: "Süresi Dolan Eczane" }], receivedAt);
    data.freshness = { ...data.freshness, freshUntil: expiry, expiresAt: expiry };
    let requests = 0;
    await page.route("**/api/nobetci-eczaneler/" + city, route => ++requests === 1
      ? route.fulfill({ headers: { Date: receivedAt.toUTCString() }, json: data })
      : route.abort("failed"));

    await page.goto(path + "/" + city);
    const row = page.getByRole("button", { name: /Süresi Dolan Eczane/ });
    await expect(row).toBeVisible();
    await page.clock.runFor(8000);
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Listeyi yenile" }).click();
    await expect(page.getByRole("button", { name: "Yenileme beklemede" })).toBeDisabled();
    await expect(row).toHaveCount(0);
    await expect(page.getByText("Güncel nöbet listesine ulaşılamadı.")).toBeVisible();
    expect(requests).toBe(2);
  });
}

test("does not reuse a live-only İstanbul response after navigation or a failed refresh", async ({ page }) => {
  await mockBasemap(page);
  await mockFeeds(page, { izmir: fixture("izmir", [{ name: "Konak Eczanesi" }]) });
  let releaseRefresh = () => {};
  const refreshGate = new Promise<void>(resolve => { releaseRefresh = resolve; });
  let requests = 0;
  await page.route("**/api/nobetci-eczaneler/istanbul", async route => {
    const request = ++requests;
    if (request > 2) return route.abort("failed");
    if (request === 2) await refreshGate;
    const data = fixture("istanbul", [{ name: request === 1 ? "İlk Canlı Eczane" : "Yeni Canlı Eczane" }]);
    data.freshness.cacheUntil = null;
    data.coverage = { status: "partial", reason: "districts-unverified" };
    await route.fulfill({ headers: { "Cache-Control": "no-store" }, json: data });
  });

  await page.goto(path + "/istanbul");
  const first = page.getByRole("button", { name: /İlk Canlı Eczane/ });
  await expect(first).toBeVisible();
  await page.getByRole("link", { name: "İzmir", exact: true }).click();
  await expect(page.getByRole("button", { name: /Konak Eczanesi/ })).toBeVisible();
  const secondRequest = page.waitForRequest("**/api/nobetci-eczaneler/istanbul", { timeout: 5000 });
  await page.getByRole("link", { name: "İstanbul", exact: true }).click();
  await secondRequest;
  await expect(first).toHaveCount(0);
  releaseRefresh();
  const refreshed = page.getByRole("button", { name: /Yeni Canlı Eczane/ });
  await expect(refreshed).toBeVisible();
  await page.getByRole("button", { name: "Listeyi yenile" }).click();
  await expect(page.getByRole("button", { name: "Yenileme beklemede" })).toBeDisabled();
  await expect(refreshed).toHaveCount(0);
  expect(requests).toBe(3);
});

test("sorts İzmir's previous-day records by distance after location is enabled", async ({ page, context }) => {
  const afterMidnight = new Date("2026-11-10T21:10:00Z");
  await page.clock.setFixedTime(afterMidnight);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ longitude: izmir[0], latitude: izmir[1], accuracy: 25 });
  await mockBasemap(page);
  const data = fixture("izmir", [
    { name: "Alsancak Eczanesi", coordinates: [27.18, 38.44], dutyDate: "2026-11-10" },
    { name: "Konumu Eksik Eczane", coordinates: null, dutyDate: "2026-11-10" },
    { name: "Merkez Eczanesi", dutyDate: "2026-11-10" },
  ], afterMidnight);
  data.dutyDate = "2026-11-10";
  data.dutyDateStatus = "outdated";
  data.freshness.statusAtFetch = "stale";
  data.freshness.freshUntil = null;
  await mockFeeds(page, { izmir: data });

  await page.goto(path + "/izmir");
  const results = page.getByRole("region", { name: "Eczane listesi" });
  const names = results.locator(".pharmacy-result-name strong");
  await expect(names).toHaveText(["Alsancak Eczanesi", "Konumu Eksik Eczane", "Merkez Eczanesi"]);
  await locateButton(page).click();
  await expect(page.getByText("Konumunuz · ±25 m")).toBeVisible();
  await expect(names).toHaveText(["Merkez Eczanesi", "Alsancak Eczanesi", "Konumu Eksik Eczane"]);
  await expect(results.getByText("Kuş uçuşu mesafeye göre sıralandı")).toBeVisible();
  await expect(results.getByRole("button", { name: /Merkez Eczanesi/ })).toContainText("0 m");
  await expect(page.getByText("Listenin güncelliği doğrulanamadı.")).toBeVisible();
  await expect(page.locator(".pharmacy-nearby-list")).toHaveCount(0);
});

test("keeps a reported overnight duty current at midnight and clears expired İstanbul records", async ({ page, context }) => {
  const beforeMidnight = new Date("2026-11-10T20:59:00Z");
  await page.clock.setFixedTime(beforeMidnight);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ longitude: istanbul[0], latitude: istanbul[1], accuracy: 25 });
  await mockBasemap(page);
  const dutyStart = "2026-11-10T19:00:00+03:00";
  const dutyEnd = "2026-11-11T09:00:00+03:00";
  const data = fixture("istanbul", [
    { name: "Daha Uzak Eczane", coordinates: [29.08, 41.08], dutyStart, dutyEnd },
    { name: "Kısmi Liste Eczanesi", dutyStart, dutyEnd },
  ], beforeMidnight);
  const credit = "https://turkpidya.com/tr/nobetci-eczaneler/?utm_campaign=pharmacies&utm_source=api&utm_medium=credit";
  data.source = { ...data.source, datasetUrl: credit };
  data.coverage = { status: "partial", reason: "districts-unverified", checkedDistricts: 12, expectedDistricts: 39 };
  await mockFeeds(page, { istanbul: data });
  await page.goto(path + "/istanbul");
  await expect(page.getByText(/Liste kısmi.+12\/39 ilçeden kayıt bildirdi/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Turkpidya", exact: true })).toHaveAttribute("href", credit);
  await locateButton(page).click();
  const nearbyNames = page.locator(".pharmacy-nearby-list .pharmacy-result-name strong");
  await expect(nearbyNames).toHaveText(["Kısmi Liste Eczanesi", "Daha Uzak Eczane"]);
  await page.clock.setFixedTime(new Date("2026-11-10T21:01:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(nearbyNames).toHaveText(["Kısmi Liste Eczanesi", "Daha Uzak Eczane"]);
  await page.locator(".pharmacy-nearby-list").getByRole("button", { name: /Kısmi Liste Eczanesi/ }).click();
  const details = page.getByRole("region", { name: "Kısmi Liste Eczanesi" });
  await expect(details.locator("time").filter({ hasText: "19:00" })).toHaveAttribute("datetime", dutyStart);
  await expect(details.locator("time").filter({ hasText: "09:00" })).toHaveAttribute("datetime", dutyEnd);
  await expect(details.getByRole("link", { name: "Turkpidya", exact: true })).toHaveAttribute("href", credit);
  await page.clock.setFixedTime(new Date("2026-11-10T21:04:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(page.getByText("Listenin güncelliği doğrulanamadı.")).toBeVisible();
  await expect(page.locator(".pharmacy-nearby-list")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Kısmi Liste Eczanesi/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Listeyi yenile" })).toBeEnabled();
});

test("sorts unverified İstanbul records without highlighting them as nearby duty results, and distinguishes an empty feed", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ longitude: istanbul[0], latitude: istanbul[1], accuracy: 25 });
  await mockBasemap(page);
  const unknown = fixture("istanbul", [
    { name: "Daha Uzak Eczane", coordinates: [29.08, 41.08], dutyDate: null },
    { name: "Saatleri Eksik Eczane", dutyDate: null },
  ]);
  unknown.dutyDate = null;
  unknown.dutyDateStatus = "unverified";
  unknown.freshness.statusAtFetch = "unknown";
  unknown.freshness.freshUntil = null;
  const feeds = { istanbul: unknown };
  await mockFeeds(page, feeds);
  await page.goto(path + "/istanbul");
  await expect(page.getByText("Listenin güncelliği doğrulanamadı.")).toBeVisible();
  await locateButton(page).click();
  await expect(page.getByText("Konumunuz · ±25 m")).toBeVisible();
  await expect(page.locator(".pharmacy-nearby-list")).toHaveCount(0);
  const results = page.getByRole("region", { name: "Eczane listesi" });
  await expect(results.locator(".pharmacy-result-name strong")).toHaveText(["Saatleri Eksik Eczane", "Daha Uzak Eczane"]);
  await expect(page.getByRole("link", { name: /İstanbul Eczacı Odası/ })).toBeVisible();
  feeds.istanbul = { ...unknown, pharmacies: [] };
  await page.getByRole("button", { name: "Listeyi yenile" }).click();
  await expect(page.getByText("Kaynak bu şehir için eczane kaydı bildirmedi.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Saatleri Eksik Eczane/ })).toHaveCount(0);
});

test("does not reuse an İstanbul sample that expired while viewing İzmir", async ({ page }) => {
  const initialTime = new Date("2026-11-10T20:00:00Z");
  const laterTime = new Date("2026-11-10T20:06:00Z");
  await page.clock.setFixedTime(initialTime);
  await mockBasemap(page);
  await mockFeeds(page, { izmir: fixture("izmir", [{ name: "Konak Eczanesi" }], initialTime) });
  let finishRefresh = () => {};
  const refreshGate = new Promise<void>(resolve => { finishRefresh = resolve; });
  let requests = 0;
  await page.route("**/api/nobetci-eczaneler/istanbul", async route => {
    if (++requests === 1) {
      await route.fulfill({ json: fixture("istanbul", [{ name: "Süresi Dolan Eczane" }], initialTime) });
      return;
    }
    await refreshGate;
    await route.fulfill({ json: fixture("istanbul", [{ name: "Yenilenen Liste Eczanesi" }], laterTime) });
  });
  await page.goto(path + "/istanbul");
  await expect(page.getByRole("button", { name: /Süresi Dolan Eczane/ })).toBeVisible();
  await page.getByRole("link", { name: "İzmir", exact: true }).click();
  await expect(page.getByRole("button", { name: /Konak Eczanesi/ })).toBeVisible();
  await page.clock.setFixedTime(laterTime);
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await page.getByRole("link", { name: "İstanbul", exact: true }).click();
  await expect(page).toHaveURL(path + "/istanbul");
  await expect(page.getByRole("button", { name: /Süresi Dolan Eczane/ })).toHaveCount(0);
  finishRefresh();
  await expect(page.getByRole("button", { name: /Yenilenen Liste Eczanesi/ })).toBeVisible();
  expect(requests).toBe(2);
});

test("puts nearby actions above the map on a narrow touch viewport", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ longitude: izmir[0], latitude: izmir[1], accuracy: 25 });
  await mockBasemap(page);
  await mockFeeds(page, { izmir: fixture("izmir", [{ name: "Merkez Eczanesi" }]) });
  await page.goto(path);
  await locateButton(page).click();
  const navigation = page.getByRole("link", { name: /^Yol tarifi/ });
  await expect(navigation).toBeInViewport();
  const actionBox = (await navigation.boundingBox())!;
  const mapBox = (await page.locator(".pharmacy-map").boundingBox())!;
  expect(actionBox.height).toBeGreaterThanOrEqual(44);
  expect(actionBox.y + actionBox.height).toBeLessThan(mapBox.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});
