import { pharmacyCities, type PharmacyCity, type PharmacySource } from "./pharmacy-cities";
import { getPharmacyFreshness, istanbulDay, pharmacyTimeZone, type PharmacyResponse } from "./pharmacies";
import { pharmacyProviders, type ProviderResult } from "./pharmacy-providers";
import { PharmacyUpstreamError, type ProviderFailureReason } from "./pharmacy-upstream";

const maximumDisplayMs = 24 * 60 * 60 * 1000;
const providerCooldownSeconds = 60;

function unavailable(
  city: PharmacyCity,
  reason: ProviderFailureReason,
  dutyDate: string | null = null,
  source: PharmacySource = pharmacyCities[city].source,
): PharmacyResponse {
  return {
    city, source, dutyDate,
    dutyDateStatus: reason === "outdated" ? "outdated" : "unverified",
    lastSuccessfulFetchAt: null,
    freshness: { timeZone: pharmacyTimeZone, statusAtFetch: "unavailable", cacheUntil: null, freshUntil: null, expiresAt: null },
    coverage: { status: "unknown" },
    unavailableReason: reason,
    pharmacies: [],
  };
}

class UncacheablePharmacyFeed extends Error {
  // Keep record contents out of framework logs when background revalidation fails.
  #feed: PharmacyResponse;

  constructor(feed: PharmacyResponse, readonly retryAfter: number) {
    super("Pharmacy feed refresh was incomplete or unavailable");
    this.#feed = feed;
  }

  get feed() { return this.#feed; }
}

function timedSnapshot(city: PharmacyCity, result: ProviderResult, fetchedAt: Date) {
  const schedule = result.schedule!;
  const source = result.source ?? pharmacyCities[city].source;
  const expiresAt = Math.min(schedule.cacheUntil ?? fetchedAt.getTime(), schedule.validUntil ?? Infinity);
  if (expiresAt <= fetchedAt.getTime()) throw new PharmacyUpstreamError("provider-error", undefined, undefined, source);

  const verified = schedule.status === "current";
  const deadline = new Date(expiresAt).toISOString();
  const data: PharmacyResponse = {
    city, source, dutyDate: result.dutyDate,
    dutyDateStatus: schedule.status === "current" ? "verified" : schedule.status,
    lastSuccessfulFetchAt: fetchedAt.toISOString(),
    sourceUpdatedAt: schedule.sourceUpdatedAt,
    freshness: {
      timeZone: pharmacyTimeZone,
      statusAtFetch: verified ? "fresh" : schedule.status === "upcoming" ? "upcoming" : "unknown",
      cacheUntil: schedule.reusable === false ? null : deadline,
      freshUntil: verified ? deadline : null,
      expiresAt: deadline,
    },
    coverage: result.coverage,
    pharmacies: result.pharmacies,
  };
  // Rejecting the cache callback keeps a live-only response out of Next's Data
  // Cache. A zero retry delay also keeps it out of the loader's cooldown map.
  if (schedule.reusable === false) throw new UncacheablePharmacyFeed(data, 0);
  if (!verified || result.coverage.status === "partial") {
    throw new UncacheablePharmacyFeed(data, Math.ceil((expiresAt - fetchedAt.getTime()) / 1000));
  }
  return data;
}

async function loadProviderSnapshot(city: PharmacyCity, fetchSource: typeof fetch, now: () => Date) {
  const result = await pharmacyProviders[city](fetchSource, now);
  const fetchedAt = now();
  if (result.schedule) return timedSnapshot(city, result, fetchedAt);
  if (!result.pharmacies.length) throw new PharmacyUpstreamError();

  const { date, midnight } = istanbulDay(fetchedAt);
  const yesterday = istanbulDay(new Date(midnight - maximumDisplayMs - 1)).date;
  const pharmacies = result.pharmacies.filter(pharmacy => pharmacy.dutyDate === date || pharmacy.dutyDate === yesterday);
  if (!pharmacies.length) throw new PharmacyUpstreamError("outdated", undefined, result.dutyDate ?? undefined);

  const fetchedMs = fetchedAt.getTime();
  const isToday = result.dutyDate === date;
  const cacheUntil = fetchedMs + pharmacyCities[city].cacheSeconds * 1000;
  const expiresAt = Math.min(fetchedMs + maximumDisplayMs, isToday ? Infinity : midnight);
  const data: PharmacyResponse = {
    city, source: pharmacyCities[city].source, dutyDate: result.dutyDate,
    dutyDateStatus: isToday ? "reported-today" : result.dutyDate ? "outdated" : "unverified",
    lastSuccessfulFetchAt: fetchedAt.toISOString(),
    freshness: {
      timeZone: pharmacyTimeZone,
      statusAtFetch: isToday ? "fresh" : "stale",
      cacheUntil: new Date(cacheUntil).toISOString(),
      freshUntil: isToday ? new Date(Math.min(cacheUntil, midnight)).toISOString() : null,
      expiresAt: new Date(expiresAt).toISOString(),
    },
    coverage: result.coverage,
    pharmacies,
  };
  if (!isToday || result.coverage.status === "partial") {
    throw new UncacheablePharmacyFeed(data, providerCooldownSeconds);
  }
  return data;
}

export function createPharmacyFeedLoader(fetchSource: typeof fetch = (...args) => fetch(...args), now = () => new Date()) {
  // Best effort within a warm instance. The Next Data Cache and CDN share validated snapshots.
  const inFlight = new Map<PharmacyCity, Promise<PharmacyResponse>>();
  const cooldowns = new Map<PharmacyCity, { until: number; error: UncacheablePharmacyFeed }>();
  const recent = new Map<PharmacyCity, PharmacyResponse>();

  function requestSnapshot(city: PharmacyCity) {
    return loadProviderSnapshot(city, fetchSource, now).then(data => {
      recent.set(city, data);
      return data;
    }).catch(cause => {
      let error: UncacheablePharmacyFeed;
      if (cause instanceof UncacheablePharmacyFeed) {
        error = cause;
      } else {
        const upstream = cause instanceof PharmacyUpstreamError ? cause : new PharmacyUpstreamError();
        error = new UncacheablePharmacyFeed(
          unavailable(city, upstream.reason, upstream.dutyDate, upstream.source), upstream.retryAfter ?? providerCooldownSeconds,
        );
      }
      if (error.retryAfter > 0) cooldowns.set(city, { until: now().getTime() + error.retryAfter * 1000, error });
      throw error;
    });
  }

  return async (city: PharmacyCity) => {
    const snapshot = recent.get(city);
    if (snapshot && getPharmacyFreshness(snapshot, now().getTime()) === "fresh") return snapshot;
    const cooldown = cooldowns.get(city);
    if (cooldown) {
      const secondsRemaining = Math.ceil((cooldown.until - now().getTime()) / 1000);
      if (secondsRemaining > 0) throw new UncacheablePharmacyFeed(cooldown.error.feed, secondsRemaining);
    }
    if (cooldown) cooldowns.delete(city);
    const existing = inFlight.get(city);
    if (existing) return existing.catch(error => {
      // A response that prohibits reuse cannot satisfy a collapsed request.
      // Each waiter performs one independent bounded fetch, without rejoining
      // the in-flight queue or recursively retrying another live-only result.
      if (error instanceof UncacheablePharmacyFeed && error.retryAfter === 0) return requestSnapshot(city);
      throw error;
    });

    const pending = requestSnapshot(city).finally(() => inFlight.delete(city));
    inFlight.set(city, pending);
    return pending;
  };
}

type LoadFeed = (city: PharmacyCity) => Promise<PharmacyResponse>;

export async function loadPharmacyFeed(city: PharmacyCity, cached: LoadFeed, refresh: LoadFeed, now = () => new Date()) {
  const retained = await cached(city);
  const evaluatedAt = now();
  if (!pharmacyCities[city].allowStaleData) {
    // Next's time-based cache can hand back a stale entry while revalidating.
    // The provider's HTTP expiry and the duty boundary are hard deadlines.
    return retained.freshness.cacheUntil && getPharmacyFreshness(retained, evaluatedAt.getTime()) === "fresh" ? retained : refresh(city);
  }
  const today = istanbulDay(evaluatedAt).date;
  const usable = getPharmacyFreshness(retained, evaluatedAt.getTime()) !== "unavailable";
  if (usable && retained.dutyDate === today) return retained;

  // The fixed Data Cache TTL can cross midnight. Prefer today's partial results to an old
  // schedule while preserving a same-day complete snapshot on failed revalidation.
  try {
    return await refresh(city);
  } catch (error) {
    if (error instanceof UncacheablePharmacyFeed && error.feed.dutyDate === today && error.feed.pharmacies.length) throw error;
    if (usable) return retained;
    throw error;
  }
}

export async function createPharmacyResponse(city: PharmacyCity, loadFeed: LoadFeed, now = () => new Date()) {
  let data: PharmacyResponse;
  let retryAfter: number | undefined;
  try {
    data = await loadFeed(city);
  } catch (cause) {
    data = cause instanceof UncacheablePharmacyFeed ? cause.feed : unavailable(city, "provider-error");
    retryAfter = cause instanceof UncacheablePharmacyFeed ? cause.retryAfter : providerCooldownSeconds;
  }

  const evaluatedAt = now().getTime();
  const { allowStaleData } = pharmacyCities[city];
  if (allowStaleData && !data.unavailableReason) {
    const today = istanbulDay(new Date(evaluatedAt)).date;
    data = {
      ...data,
      dutyDateStatus: data.dutyDate === today ? "reported-today" : data.dutyDate ? "outdated" : "unverified",
    };
  }
  const freshness = getPharmacyFreshness(data, evaluatedAt);
  if (freshness === "unavailable") {
    const safe = data.unavailableReason ? data : {
      ...unavailable(city, allowStaleData ? "outdated" : "provider-error", data.dutyDate, data.source),
      lastSuccessfulFetchAt: data.lastSuccessfulFetchAt,
    };
    return Response.json(safe, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter ?? providerCooldownSeconds) },
    });
  }

  const remaining = Math.floor((Date.parse(data.freshness.expiresAt ?? "") - evaluatedAt) / 1000);
  if (!allowStaleData) {
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (remaining > 0 && data.freshness.cacheUntil) {
      headers["Cache-Control"] = "public, max-age=0, must-revalidate";
      headers["Vercel-CDN-Cache-Control"] = "public, must-revalidate, s-maxage=" + remaining;
    }
    if (retryAfter) headers["Retry-After"] = String(retryAfter);
    return Response.json(data, { headers });
  }

  const freshSeconds = Math.floor((Date.parse(data.freshness.freshUntil ?? "") - evaluatedAt) / 1000);
  if (retryAfter) {
    // A current-date partial response may be served on a cold cache, with its warning attached.
    // It never replaces a usable snapshot in the Data Cache.
    const partialSeconds = Math.min(freshSeconds, retryAfter);
    const headers: Record<string, string> = { "Cache-Control": "no-store", "Retry-After": String(retryAfter) };
    if (freshness === "fresh" && data.coverage.status === "partial" && partialSeconds > 0) {
      headers["Cache-Control"] = "public, max-age=0, must-revalidate";
      headers["Vercel-CDN-Cache-Control"] = "public, s-maxage=" + partialSeconds;
    }
    return Response.json(data, { headers });
  }

  const sharedSeconds = Math.max(0, Math.min(remaining, freshness === "fresh" ? freshSeconds : 30));
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Vercel-CDN-Cache-Control": `public, s-maxage=${sharedSeconds}, stale-if-error=${Math.max(0, remaining - sharedSeconds)}`,
    },
  });
}
