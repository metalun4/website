"use client";

import { ArrowUpRight, CalendarDays, ChevronRight, CircleAlert, LocateFixed, Phone, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  distanceKm,
  filterPharmacies,
  getPharmacyFreshness,
  pharmacySource,
  pharmacyTimeZone,
  type Coordinates,
  type Pharmacy,
  type PharmacyResponse,
} from "@/lib/pharmacies";
import { PharmacyMap, type MapTarget } from "./pharmacy-map";

const emptyPharmacies: Pharmacy[] = [];
const dutyDateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "UTC" });
const fetchDateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: pharmacyTimeZone });
const numberFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const pharmacyOrder = new Intl.Collator("tr-TR", { sensitivity: "base" });

function formatDutyDate(date: string) {
  return dutyDateFormat.format(new Date(date + "T00:00:00Z"));
}

function formatDistance(distance: number) {
  return distance < 1
    ? numberFormat.format(Math.round(distance * 1000)) + " m"
    : numberFormat.format(distance) + " km";
}

type LoadedFeed = { data: PharmacyResponse; evaluatedAt: number; sampledAt: number };

function usePharmacyFeed() {
  const [feed, setFeed] = useState<LoadedFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const freshness = feed ? getPharmacyFreshness(feed.data, feed.evaluatedAt) : "unavailable";

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    async function load() {
      try {
        const response = await fetch("/api/nobetci-eczaneler", { credentials: "omit", signal: controller.signal });
        if (!response.ok) return;
        const data: PharmacyResponse = await response.json();
        if (!Array.isArray(data?.pharmacies) || !data.freshness || !data.lastSuccessfulFetchAt) return;

        const fetchedAt = Date.parse(data.lastSuccessfulFetchAt);
        if (!Number.isFinite(fetchedAt)) return;
        const age = Number(response.headers.get("age")) || 0;
        const originDate = Date.parse(response.headers.get("date") ?? "") || 0;
        const evaluatedAt = Math.max(Date.now(), originDate, fetchedAt + age * 1000);
        if (!disposed) setFeed({ data, evaluatedAt, sampledAt: performance.now() });
      } catch {
        // Retain any previously displayed snapshot if a manual refresh fails.
      } finally {
        window.clearTimeout(timeout);
        if (!disposed) setLoading(false);
      }
    }
    void load();
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  useEffect(() => {
    const freshUntil = feed?.data.freshness.freshUntil;
    if (!feed || freshness !== "fresh" || !freshUntil) return;
    const deadline = Date.parse(freshUntil);
    const currentTime = () => Math.max(Date.now(), feed.evaluatedAt + performance.now() - feed.sampledAt);
    const check = () => {
      const now = currentTime();
      if (now >= deadline) setFeed(current => current === feed ? { ...feed, evaluatedAt: now } : current);
    };
    const timer = window.setTimeout(check, Math.max(0, Math.ceil(deadline - currentTime())));
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, [feed, freshness]);

  return {
    data: feed?.data ?? null,
    freshness,
    loading,
    initiallyLoading: loading && attempt === 0,
    refresh() {
      setLoading(true);
      setAttempt(attempt => attempt + 1);
    },
  };
}

function revealDetails(heading: HTMLHeadingElement | null) {
  heading?.focus({ preventScroll: true });
  heading?.closest("section")?.scrollIntoView({ block: "nearest" });
}

function PharmacyDetails({ pharmacy, distance, stale, headingRef, onClose }: {
  pharmacy: Pharmacy;
  distance: number | null;
  stale: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
}) {
  const destination = pharmacy.coordinates ? pharmacy.coordinates[1] + "," + pharmacy.coordinates[0] : null;

  return (
    <section className="pharmacy-details" aria-labelledby="pharmacy-detail-heading">
      <div className="pharmacy-detail-heading">
        <div>
          <h2 id="pharmacy-detail-heading" ref={headingRef} tabIndex={-1}>{pharmacy.name}</h2>
          {pharmacy.region ? <p>{pharmacy.region}</p> : null}
        </div>
        <button type="button" className="pharmacy-icon-button" onClick={onClose} aria-label="Eczane ayrıntılarını kapat">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <dl>
        <div><dt>Adres</dt><dd>{pharmacy.address ?? "Paylaşılmamış"}</dd></div>
        <div><dt>Telefon</dt><dd>{pharmacy.phone ?? "Paylaşılmamış"}</dd></div>
        <div><dt>Nöbet tarihi</dt><dd><time dateTime={pharmacy.dutyDate}>{formatDutyDate(pharmacy.dutyDate)}</time></dd></div>
        {distance !== null ? <div><dt>Kuş uçuşu</dt><dd>{formatDistance(distance)}</dd></div> : null}
      </dl>
      {pharmacy.dutyNote ? (
        <p className="pharmacy-duty-note"><strong>Belediye notu</strong> {pharmacy.dutyNote}</p>
      ) : null}
      {stale ? <p className="pharmacy-detail-warning" role="status">Güncel nöbet durumu doğrulanamadı. Gitmeden önce eczaneyi arayın.</p> : null}
      <div className="pharmacy-actions">
        {pharmacy.dialNumber ? (
          <a className="pharmacy-button" href={"tel:" + pharmacy.dialNumber}><Phone size={17} aria-hidden="true" /> Ara</a>
        ) : null}
        {destination ? (
          <a className="pharmacy-button pharmacy-button-primary"
            href={"https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(destination)}
            target="_blank" rel="noopener noreferrer">
            Yol tarifi <ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only"> (Google Haritalar, yeni sekme)</span>
          </a>
        ) : <p className="pharmacy-muted">Harita konumu paylaşılmamış.</p>}
      </div>
    </section>
  );
}

export function PharmacyFinder() {
  const { data, freshness, loading, initiallyLoading, refresh } = usePharmacyFeed();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [target, setTarget] = useState<MapTarget | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const selectionOrigin = useRef<HTMLElement | null>(null);
  const locationRequest = useRef(0);
  const pharmacies = data?.pharmacies ?? emptyPharmacies;
  const visible = useMemo(() => filterPharmacies(pharmacies, query), [pharmacies, query]);
  const results = useMemo(() => visible.map(pharmacy => ({
    pharmacy,
    distance: userLocation && pharmacy.coordinates ? distanceKm(userLocation, pharmacy.coordinates) : null,
  })).sort((left, right) => {
    const leftDistance = left.distance ?? Infinity;
    const rightDistance = right.distance ?? Infinity;
    return leftDistance === rightDistance ? pharmacyOrder.compare(left.pharmacy.name, right.pharmacy.name) : leftDistance - rightDistance;
  }), [visible, userLocation]);
  const selection = results.find(({ pharmacy }) => pharmacy.id === selectedId);

  useEffect(() => {
    if (selectedId) revealDetails(detailHeading.current);
  }, [selectedId]);

  useEffect(() => () => { locationRequest.current += 1; }, []);

  function choosePharmacy(id: string, origin?: HTMLElement) {
    const pharmacy = visible.find(pharmacy => pharmacy.id === id);
    if (!pharmacy) return;
    selectionOrigin.current = origin ?? search.current;
    setSelectedId(id);
    if (pharmacy.coordinates) setTarget({ coordinates: pharmacy.coordinates, minZoom: 14 });
    if (selectedId === id) revealDetails(detailHeading.current);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setSelectedId(null);
  }

  function locate() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Bu tarayıcı konum bilgisi sağlayamıyor.");
      return;
    }
    setLocating(true);
    const request = ++locationRequest.current;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (locationRequest.current !== request) return;
      const coordinates: Coordinates = [coords.longitude, coords.latitude];
      setUserLocation(coordinates);
      setTarget({ coordinates, minZoom: 13 });
      setLocating(false);
    }, error => {
      if (locationRequest.current !== request) return;
      setLocationError(error.code === 1
        ? "Konum izni verilmedi. Eczaneleri arayarak bulabilirsiniz."
        : "Konumunuz alınamadı. Tekrar deneyebilirsiniz.");
      setLocating(false);
    }, { timeout: 10000, maximumAge: 60000 });
  }

  const StatusIcon = freshness === "fresh" || initiallyLoading ? CalendarDays : CircleAlert;

  return (
    <>
      <div className="pharmacy-status">
        <div className="pharmacy-status-copy" role="status" aria-live="polite">
          <StatusIcon size={19} aria-hidden="true" />
          <div>
            {initiallyLoading ? <strong>Nöbet listesi yükleniyor…</strong> : freshness === "fresh" && data?.dutyDate ? (
              <>
                <strong><time dateTime={data.dutyDate}>{formatDutyDate(data.dutyDate)}</time> nöbet listesi</strong>
                <p>Gitmeden önce eczaneyi arayın.</p>
              </>
            ) : freshness === "stale" ? (
              <>
                <strong>Güncel nöbet durumu doğrulanamadı.</strong>
                <p>{data?.dutyDate ? formatDutyDate(data.dutyDate) + " tarihli liste gösteriliyor. " : "Farklı nöbet tarihleri bildirildi. "}Nöbetler gece yarısını aşabilir. Gitmeden önce eczaneyi arayın.</p>
              </>
            ) : (
              <>
                <strong>Nöbet listesine ulaşılamadı.</strong>
                <p>Güncel nöbet durumu doğrulanamadı.</p>
              </>
            )}
          </div>
        </div>
        {data?.lastSuccessfulFetchAt ? (
          <p className="pharmacy-last-fetch">Son veri alımı <time dateTime={data.lastSuccessfulFetchAt}>{fetchDateFormat.format(new Date(data.lastSuccessfulFetchAt))}</time></p>
        ) : null}
        {!initiallyLoading && freshness !== "fresh" ? (
          <button type="button" className="pharmacy-button" disabled={loading} onClick={refresh}>
            {loading ? "Yenileniyor…" : "Veriyi yenile"}
          </button>
        ) : null}
      </div>

      <div className="pharmacy-workspace">
        <div className="pharmacy-map-column">
          <PharmacyMap pharmacies={visible} selectedId={selection?.pharmacy.id ?? null} userLocation={userLocation} target={target} onSelect={choosePharmacy}>
            <div className="pharmacy-toolbar">
              <div className="pharmacy-search" role="search">
                <Search size={19} aria-hidden="true" />
                <label htmlFor="pharmacy-search" className="sr-only">Eczane adı, bölge veya adres ara</label>
                <input ref={search} id="pharmacy-search" type="search" value={query}
                  onChange={event => updateQuery(event.target.value)} placeholder="Eczane, bölge veya adres"
                  autoComplete="off" spellCheck={false} disabled={!pharmacies.length} />
                {query ? (
                  <button type="button" className="pharmacy-icon-button" aria-label="Aramayı temizle" onClick={() => {
                    updateQuery("");
                    search.current?.focus();
                  }}><X size={17} aria-hidden="true" /></button>
                ) : null}
              </div>
              <button type="button" className="pharmacy-button pharmacy-locate" onClick={locate} disabled={locating}>
                <LocateFixed size={18} aria-hidden="true" /> {locating ? "Konum aranıyor…" : "Konumumu Bul"}
              </button>
              {locationError ? <p className="pharmacy-location-error" role="status">{locationError}</p> : null}
            </div>
          </PharmacyMap>
          <footer className="pharmacy-credits">
            <p>Eczane verisi <a href={pharmacySource.datasetUrl}>{pharmacySource.name}</a> · <a href={pharmacySource.licenseUrl}>CC BY 4.0</a>. Kayıtlar harita için düzenlenmiştir.</p>
            <p>Harita <a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap katkıcıları</a></p>
          </footer>
        </div>

        <div className="pharmacy-panel">
          {selection ? (
            <PharmacyDetails pharmacy={selection.pharmacy} distance={selection.distance} stale={freshness === "stale"} headingRef={detailHeading} onClose={() => {
              setSelectedId(null);
              (selectionOrigin.current?.isConnected ? selectionOrigin.current : search.current)?.focus();
            }} />
          ) : null}
          <section className="pharmacy-results" aria-labelledby="pharmacy-results">
            <div className="pharmacy-results-heading">
              <h2 id="pharmacy-results" tabIndex={-1}>Eczane listesi</h2>
              {data ? <p role="status">{results.length} sonuç</p> : null}
            </div>
            {userLocation ? <p className="pharmacy-distance-note" role="status"><span aria-hidden="true" /> Konumunuz · Kuş uçuşu mesafeye göre sıralandı</p> : null}
            {results.length ? (
              <ul className="pharmacy-results-list">
                {results.map(({ pharmacy, distance }) => (
                  <li key={pharmacy.id}>
                    <button type="button" aria-current={pharmacy.id === selectedId ? "true" : undefined} onClick={event => choosePharmacy(pharmacy.id, event.currentTarget)}>
                      <span className="pharmacy-result-name">
                        <strong>{pharmacy.name}</strong>
                        {pharmacy.region ? <span>{pharmacy.region}</span> : null}
                      </span>
                      {distance !== null ? <span className="pharmacy-distance">{formatDistance(distance)}</span> : null}
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pharmacy-empty">{loading && !data ? "Liste hazırlanıyor…" : data ? "Aramanızla eşleşen eczane bulunamadı." : "Gösterilecek eczane bilgisi yok."}</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
