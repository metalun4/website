import { unstable_cache } from "next/cache";
import { isPharmacyCity, pharmacyCities, pharmacyCitySlugs, type PharmacyCity } from "./pharmacy-cities";
import { createPharmacyFeedLoader, createPharmacyResponse, loadPharmacyFeed } from "./pharmacy-feed";
import { pharmacyPath } from "./site";

const refresh = createPharmacyFeedLoader();
const cityLoads = new Map(pharmacyCitySlugs.map(city => [city, unstable_cache(
  () => refresh(city),
  ["duty-pharmacy-feed-v3", city, pharmacyCities[city].source.id],
  { revalidate: pharmacyCities[city].cacheSeconds },
)]));

export function cityPharmacyRoute(request: Request, city: string) {
  const url = new URL(request.url);
  const basePath = "/api" + pharmacyPath;
  const validPath = url.pathname === basePath + "/" + city || (url.pathname === basePath && city === "izmir");
  if (!isPharmacyCity(city) || !validPath) {
    return Response.json({ error: "Bu şehir desteklenmiyor." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (url.search) {
    return Response.json({ error: "Bu uç nokta sorgu parametresi kabul etmez." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  return createPharmacyResponse(city, key => loadPharmacyFeed(key, loadCachedCity, refresh));
}

function loadCachedCity(city: PharmacyCity) {
  return cityLoads.get(city)!();
}
