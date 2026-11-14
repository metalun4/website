"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { pharmacyCities, pharmacyCitySlugs, type PharmacyCity } from "@/lib/pharmacy-cities";
import { getPharmacyFreshness, retryAfterSeconds, type PharmacyResponse } from "@/lib/pharmacies";
import { pharmacyPath } from "@/lib/site";

type FeedSample = {
  attempt: number | null;
  data: PharmacyResponse | null;
  evaluatedAt: number;
  sampledAt: number;
  retryAt: number | null;
  failed: boolean;
};

const browserTimeoutMs = 20000;
const maxTimerDelay = 2147483647;

function readFeed(value: unknown, city: PharmacyCity): PharmacyResponse | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<PharmacyResponse>;
  if (data.city !== city || !Array.isArray(data.pharmacies) || !data.freshness || !data.coverage) return null;
  if (data.source?.id !== pharmacyCities[city].source.id) return null;
  if (data.lastSuccessfulFetchAt !== null && !Number.isFinite(Date.parse(data.lastSuccessfulFetchAt ?? ""))) return null;
  if (data.pharmacies.length && !Number.isFinite(Date.parse(data.freshness.expiresAt ?? ""))) return null;
  if (data.dutyDate !== null && !Number.isFinite(Date.parse(data.dutyDate ?? ""))) return null;
  return data as PharmacyResponse;
}

function currentTime(sample: FeedSample) {
  return Math.max(Date.now(), sample.evaluatedAt + performance.now() - sample.sampledAt);
}

function nextDeadline(sample: FeedSample) {
  return Math.min(...[
    Date.parse(sample.data?.freshness.freshUntil ?? ""),
    Date.parse(sample.data?.freshness.expiresAt ?? ""),
    sample.retryAt ?? 0,
  ].filter(deadline => deadline > sample.evaluatedAt));
}

export function usePharmacyFeed(city: PharmacyCity | null) {
  const [samples, setSamples] = useState<Partial<Record<PharmacyCity, FeedSample>>>({});
  const [attempts, setAttempts] = useState<Partial<Record<PharmacyCity, number>>>({});
  const [previousCity, setPreviousCity] = useState(city);
  if (previousCity !== city) {
    setPreviousCity(city);
    const previous = previousCity ? samples[previousCity] : undefined;
    // A live-only response belongs to the current visit. Keep its clock, but discard its records.
    if (previousCity && previous && !previous.failed && previous.data?.freshness.cacheUntil === null) {
      setSamples({ ...samples, [previousCity]: { ...previous, data: null, attempt: null } });
    }
  }
  const sample = city ? samples[city] : undefined;
  const attempt = (city && attempts[city]) || 0;
  const freshness = sample?.data ? getPharmacyFreshness(sample.data, sample.evaluatedAt) : "unavailable";
  const loading = Boolean(city && sample?.attempt !== attempt);
  const coolingDown = Boolean(sample?.retryAt && sample.evaluatedAt < sample.retryAt);
  const readSample = useEffectEvent((key: PharmacyCity) => samples[key]);

  useEffect(() => {
    if (!city) return;
    const previous = readSample(city);
    if (previous?.attempt === attempt) {
      const now = currentTime(previous);
      if ((previous.retryAt && previous.retryAt > now)
        || (previous.data?.freshness.cacheUntil && getPharmacyFreshness(previous.data, now) === "fresh")) return;
    }

    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), browserTimeoutMs);
    async function load(key: PharmacyCity) {
      let data: PharmacyResponse | null = null;
      let failed = true;
      let serverTime = 0;
      let ageMs = 0;
      let retryHeader: string | null = null;
      let defaultRetry: number | undefined;
      try {
        const response = await fetch("/api" + pharmacyPath + "/" + key, { credentials: "omit", signal: controller.signal });
        if (response.ok || response.status === 503) data = readFeed(await response.json().catch(() => null), key);
        failed = !response.ok || !data;

        const fetchedAt = Date.parse(data?.lastSuccessfulFetchAt ?? "") || 0;
        const originDate = Date.parse(response.headers.get("date") ?? "") || 0;
        const age = Number(response.headers.get("age"));
        ageMs = Number.isFinite(age) && age >= 0 ? age * 1000 : 0;
        serverTime = Math.max(originDate, fetchedAt) + ageMs;
        retryHeader = response.headers.get("retry-after");
        defaultRetry = response.status === 429 ? 60 : failed ? 10 : undefined;
      } catch {
        defaultRetry = 10;
      } finally {
        window.clearTimeout(timeout);
      }
      if (disposed) return;
      const sampledAt = performance.now();
      const deviceTime = Date.now();
      setSamples(current => {
        const prior = current[key];
        const priorTime = prior ? prior.evaluatedAt + Math.max(0, sampledAt - prior.sampledAt) : 0;
        const evaluatedAt = Math.max(deviceTime, serverTime, priorTime);
        const retrySeconds = retryAfterSeconds(retryHeader, evaluatedAt);
        const retry = retrySeconds && /^\d+$/.test(retryHeader ?? "")
          ? Math.max(0, retrySeconds - ageMs / 1000) : retrySeconds ?? defaultRetry;
        const retryAt = retry ? evaluatedAt + retry * 1000 : null;
        const retained = prior?.data;
        return {
          ...current,
          [key]: {
            data: failed && retained?.freshness.cacheUntil && getPharmacyFreshness(retained, evaluatedAt) !== "unavailable"
              ? retained : data,
            failed, attempt, evaluatedAt, sampledAt, retryAt,
          },
        };
      });
    }
    void load(city);
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [city, attempt]);

  useEffect(() => {
    // An inactive city's sample must also expire before a later city switch can reuse it.
    const monitored = pharmacyCitySlugs.flatMap(key => {
      const entry = samples[key];
      if (!entry) return [];
      const deadline = nextDeadline(entry);
      return Number.isFinite(deadline) ? [{ key, entry, deadline }] : [];
    });
    if (!monitored.length) return;

    let timer: number;
    function schedule() {
      const remaining = Math.min(...monitored.map(({ entry, deadline }) => deadline - currentTime(entry)));
      timer = window.setTimeout(check, Math.min(maxTimerDelay, Math.max(0, Math.ceil(remaining))));
    }
    function check() {
      window.clearTimeout(timer);
      const due = monitored.map(item => ({ ...item, evaluatedAt: currentTime(item.entry) }))
        .filter(item => item.evaluatedAt >= item.deadline);
      if (!due.length) {
        schedule();
        return;
      }
      const sampledAt = performance.now();
      setSamples(current => {
        const updated = { ...current };
        for (const { key, entry, evaluatedAt } of due) {
          if (current[key] === entry) updated[key] = { ...entry, evaluatedAt, sampledAt };
        }
        return updated;
      });
    }
    schedule();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [samples]);

  return {
    data: sample?.data ?? null, freshness, loading, coolingDown, failed: sample?.failed ?? false,
    refresh() {
      if (!city || loading || coolingDown) return;
      setAttempts(current => ({ ...current, [city]: (current[city] ?? 0) + 1 }));
    },
  };
}
