"use client";

import { ArrowUpRight, CalendarDays, ChevronRight, CircleAlert, LocateFixed, Phone, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isPharmacyCity, pharmacyCities, pharmacyCityPath, pharmacyCitySlugs, type PharmacyCity, type PharmacySource } from "@/lib/pharmacy-cities";
import { geolocationError, locatePharmacyCity, lowAccuracyMeters, type SearchLocation } from "@/lib/pharmacy-geography";
import { filterPharmacies, navigationLinks, pharmacyTimeZone, rankPharmacies, type Coordinates, type Pharmacy, type PharmacyCoverage } from "@/lib/pharmacies";
import { pharmacyPath } from "@/lib/site";
import { PharmacyMap, type MapTarget } from "./pharmacy-map";
import { usePharmacyFeed } from "./use-pharmacy-feed";

const emptyPharmacies: Pharmacy[] = [];
const emptyCoordinates: Coordinates[] = [];
const dutyDateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "UTC" });
const fetchDateFormat = new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: pharmacyTimeZone });
const dutyTimeFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: pharmacyTimeZone });
const numberFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

function formatDutyDate(date: string) {
  return dutyDateFormat.format(new Date(date + "T00:00:00Z"));
}

function formatDistance(distance: number) {
  return distance < 1
    ? numberFormat.format(Math.round(distance * 1000)) + " m"
    : numberFormat.format(distance) + " km";
}

function coverageNote({ status, expectedDistricts, checkedDistricts, reason }: PharmacyCoverage) {
  if (status === "complete") return null;
  const reported = expectedDistricts && checkedDistricts ? ` Kaynak ${checkedDistricts}/${expectedDistricts} ilçeden kayıt bildirdi.` : "";
  if (status === "unknown") return "Listenin tüm nöbetleri kapsadığı doğrulanamadı." + reported;
  switch (reason) {
    case "mixed-dates": return "Liste kısmi. Kaynak farklı nöbet tarihleri bildirdi." + reported;
    case "unverified-records": return "Liste kısmi. Bazı kayıtların nöbet durumu doğrulanamadı." + reported;
    default: return "Liste kısmi. Yalnızca alınabilen kayıtlar gösteriliyor." + reported;
  }
}

type Feed = ReturnType<typeof usePharmacyFeed>;

function PharmacyCredit({ source, showLicense = false }: { source: PharmacySource; showLicense?: boolean }) {
  return (
    <p className="pharmacy-source">
      Veri kaynağı <a href={source.datasetUrl} rel="nofollow">{source.name}</a>
      {showLicense && source.licenseUrl ? <> · <a href={source.licenseUrl}>CC BY 4.0</a>. Kayıtlar harita için düzenlenmiştir.</> : null}
    </p>
  );
}

function FeedStatus({ city, feed }: { city: PharmacyCity; feed: Feed }) {
  const { data, freshness, loading, coolingDown, failed } = feed;
  const source: PharmacySource = data?.source ?? pharmacyCities[city].source;
  const available = Boolean(freshness !== "unavailable" && data?.pharmacies.length);
  const note = available && data ? coverageNote(data.coverage) : null;
  const verifiedDate = freshness === "fresh" && !failed;
  const sourceTime = data?.sourceUpdatedAt ?? data?.lastSuccessfulFetchAt;
  const Icon = verifiedDate || loading ? CalendarDays : CircleAlert;
  let heading: ReactNode;
  let detail: string | null;
  if (loading && !available) {
    heading = "Nöbet listesi yükleniyor…";
    detail = null;
  } else if (verifiedDate && data?.dutyDate) {
    heading = <><time dateTime={data.dutyDate}>{formatDutyDate(data.dutyDate)}</time> nöbet listesi</>;
    detail = "Gitmeden önce nöbet saatini telefonla doğrulayın.";
  } else if (freshness === "upcoming" && available) {
    heading = "Bildirilen nöbet henüz başlamadı.";
    detail = "Eczane ayrıntılarındaki nöbet saatlerini kontrol edin.";
  } else if (available || (!failed && data?.pharmacies.length)) {
    heading = "Listenin güncelliği doğrulanamadı.";
    detail = available ? "Gitmeden önce nöbet saatini telefonla doğrulayın." : "Güncel kayıtları almak için listeyi yenileyin.";
  } else if (data && freshness !== "unavailable") {
    heading = "Kaynak bu şehir için eczane kaydı bildirmedi.";
    detail = "Güncel nöbet listesini Eczacı Odasından kontrol edebilirsiniz.";
  } else if (data?.unavailableReason === "rate-limited") {
    heading = "Kaynak geçici olarak istekleri sınırlıyor.";
    detail = "Bekleme süresi dolduğunda listeyi yenileyebilir veya Eczacı Odasına bakabilirsiniz.";
  } else {
    heading = "Güncel nöbet listesine ulaşılamadı.";
    detail = data?.dutyDate ? "Kaynağın bildirdiği tarih " + formatDutyDate(data.dutyDate) + "."
      : "Kısa süre sonra tekrar deneyebilirsiniz.";
  }
  return (
    <div className="pharmacy-status">
      <div className="pharmacy-status-copy" role="status">
        <Icon size={19} aria-hidden="true" />
        <div>
          <strong>{heading}</strong>
          {detail ? <p>{detail}</p> : null}
          {note ? <p className="pharmacy-coverage">{note}</p> : null}
        </div>
      </div>
      <div className="pharmacy-status-actions">
        <PharmacyCredit source={source} showLicense />
        {available && sourceTime ? (
          <p className="pharmacy-last-fetch">
            {data?.sourceUpdatedAt ? "Kaynak güncellemesi" : "Son veri alımı"}{" "}
            <time dateTime={sourceTime}>{fetchDateFormat.format(new Date(sourceTime))}</time>
          </p>
        ) : null}
        {source.officialListUrl && ((!verifiedDate && !loading) || note) ? (
          <a className="pharmacy-button" href={source.officialListUrl} target="_blank" rel="noopener noreferrer">
            {pharmacyCities[city].name} Eczacı Odası <ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> (yeni sekme)</span>
          </a>
        ) : null}
        {(!verifiedDate || data?.coverage.status === "partial") && (!loading || available) ? (
          <button type="button" className="pharmacy-button" disabled={loading || coolingDown} onClick={feed.refresh}>
            {loading ? "Yenileniyor…" : coolingDown ? "Yenileme beklemede" : "Listeyi yenile"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PharmacyActions({ pharmacy, showApple = false }: { pharmacy: Pharmacy; showApple?: boolean }) {
  const links = pharmacy.coordinates ? navigationLinks(pharmacy.coordinates) : null;
  return (
    <div className="pharmacy-actions">
      {pharmacy.dialNumber ? (
        <a className="pharmacy-button" href={"tel:" + pharmacy.dialNumber}>
          <Phone size={16} aria-hidden="true" /> Ara<span className="sr-only"> ({pharmacy.name})</span>
        </a>
      ) : null}
      {links ? (
        <a className="pharmacy-button pharmacy-button-primary" href={links.google} target="_blank" rel="noopener noreferrer">
          Yol tarifi <ArrowUpRight size={16} aria-hidden="true" />
          <span className="sr-only"> ({pharmacy.name}, Google Haritalar, yeni sekme)</span>
        </a>
      ) : showApple ? <p className="pharmacy-muted">Harita konumu paylaşılmamış.</p> : null}
      {showApple && links ? (
        <a className="pharmacy-button" href={links.apple} target="_blank" rel="noopener noreferrer">
          Apple Haritalar <ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> (yeni sekme)</span>
        </a>
      ) : null}
    </div>
  );
}

type RankedPharmacy = ReturnType<typeof rankPharmacies>[number];

function PharmacyDetails({ pharmacy, distance, source, warning, headingRef, onClose }: RankedPharmacy & {
  source: PharmacySource;
  warning: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
}) {
  return (
    <section className="pharmacy-details" aria-labelledby="pharmacy-detail-heading">
      <div className="pharmacy-detail-heading">
        <div>
          <h2 id="pharmacy-detail-heading" ref={headingRef} tabIndex={-1}>{pharmacy.name}</h2>
          <p>{[pharmacy.region, pharmacyCities[pharmacy.city].name].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" className="pharmacy-icon-button" onClick={onClose} aria-label="Eczane ayrıntılarını kapat">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <dl>
        <div><dt>Adres</dt><dd>{pharmacy.address ?? "Paylaşılmamış"}</dd></div>
        <div><dt>Telefon</dt><dd>{pharmacy.phone ?? "Paylaşılmamış"}</dd></div>
        <div>
          <dt>Nöbet tarihi</dt>
          <dd>{pharmacy.dutyDate ? <time dateTime={pharmacy.dutyDate}>{formatDutyDate(pharmacy.dutyDate)}</time> : "Doğrulanamadı"}</dd>
        </div>
        {pharmacy.dutyStart && pharmacy.dutyEnd ? (
          <div>
            <dt>Bildirilen nöbet saatleri</dt>
            <dd>
              <time dateTime={pharmacy.dutyStart}>{dutyTimeFormat.format(new Date(pharmacy.dutyStart))}</time>
              {" – "}
              <time dateTime={pharmacy.dutyEnd}>{dutyTimeFormat.format(new Date(pharmacy.dutyEnd))}</time>
            </dd>
          </div>
        ) : null}
        {distance !== null ? <div><dt>Kuş uçuşu</dt><dd>{formatDistance(distance)}</dd></div> : null}
      </dl>
      {pharmacy.dutyNote ? <p className="pharmacy-duty-note"><strong>Kaynak notu</strong> {pharmacy.dutyNote}</p> : null}
      {warning ? <p className="pharmacy-duty-note">Güncel nöbet durumu doğrulanamadı. Gitmeden önce eczaneyi arayın.</p> : null}
      <PharmacyActions pharmacy={pharmacy} showApple />
      <PharmacyCredit source={source} />
    </section>
  );
}

type SelectPharmacy = (id: string, origin: HTMLElement) => void;

function PharmacyList({ results, selectedId, onSelect, directActions = false }: {
  results: RankedPharmacy[];
  selectedId: string | null;
  onSelect: SelectPharmacy;
  directActions?: boolean;
}) {
  return (
    <ul className={directActions ? "pharmacy-results-list pharmacy-nearby-list" : "pharmacy-results-list"}>
      {results.map(({ pharmacy, distance }) => (
        <li key={pharmacy.id}>
          <button type="button" className="pharmacy-result-button" aria-current={pharmacy.id === selectedId ? "true" : undefined}
            onClick={event => onSelect(pharmacy.id, event.currentTarget)}>
            <span className="pharmacy-result-name">
              <strong>{pharmacy.name}</strong>
              {pharmacy.region ? <span>{pharmacy.region}</span> : null}
            </span>
            {distance !== null ? <span className="pharmacy-distance">{formatDistance(distance)}</span> : null}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          {directActions ? <PharmacyActions pharmacy={pharmacy} /> : null}
        </li>
      ))}
    </ul>
  );
}

function revealDetails(heading: HTMLHeadingElement | null) {
  heading?.focus({ preventScroll: true });
  heading?.closest("section")?.scrollIntoView({ block: "nearest" });
}

export function PharmacyFinder({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const slug = pathname.slice(pharmacyPath.length + 1);
  const city = isPharmacyCity(slug) ? slug : null;
  const feed = usePharmacyFeed(city);
  const [searchValue, setSearchValue] = useState({ city, value: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [position, setPosition] = useState<SearchLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [interactionPath, setInteractionPath] = useState(pathname);
  const [target, setTarget] = useState<MapTarget | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const selectionOrigin = useRef<HTMLElement | null>(null);
  const locationRequest = useRef(0);

  if (interactionPath !== pathname) {
    setInteractionPath(pathname);
    setPicking(false);
    setLocating(false);
    setLocationError(null);
  }

  const query = searchValue.city === city ? searchValue.value : "";
  const deferredQuery = useDeferredValue(query);
  const activePosition = position?.city === city ? position : null;
  const origin = activePosition?.coordinates ?? null;
  const currentDutyList = feed.freshness === "fresh" && !feed.failed;
  const pharmacies = feed.freshness !== "unavailable" ? feed.data?.pharmacies ?? emptyPharmacies : emptyPharmacies;
  const filtered = useMemo(() => filterPharmacies(pharmacies, deferredQuery), [pharmacies, deferredQuery]);
  const results = useMemo(() => rankPharmacies(filtered, origin), [filtered, origin]);
  const nearest = useMemo(() => currentDutyList && origin ? results.filter(result => result.distance !== null).slice(0, 4) : [], [results, origin, currentDutyList]);
  const nearbyCoordinates = useMemo(() => nearest.flatMap(({ pharmacy }) => pharmacy.coordinates ? [pharmacy.coordinates] : []), [nearest]);
  const selection = results.find(({ pharmacy }) => pharmacy.id === selectedId);
  const selectionId = selection?.pharmacy.id;

  useEffect(() => {
    if (selectionId) revealDetails(detailHeading.current);
  }, [selectionId]);

  useEffect(() => () => { locationRequest.current++; }, [pathname]);

  const cancelLocationRequest = useCallback(() => {
    locationRequest.current++;
    setLocating(false);
  }, []);

  const choosePharmacy: SelectPharmacy = useCallback((id, origin) => {
    const pharmacy = filtered.find(pharmacy => pharmacy.id === id);
    if (!pharmacy) return;
    cancelLocationRequest();
    setPicking(false);
    selectionOrigin.current = origin;
    setSelectedId(id);
    setTarget(pharmacy.coordinates ? { city: pharmacy.city, kind: "pharmacy", coordinates: pharmacy.coordinates } : null);
    if (id === selectionId) revealDetails(detailHeading.current);
  }, [cancelLocationRequest, filtered, selectionId]);

  const applyPosition = useCallback((coordinates: Coordinates, accuracy: number | null) => {
    const match = locatePharmacyCity(coordinates, accuracy);
    setPicking(false);
    setSelectedId(null);
    if (!match) {
      setPosition(null);
      setTarget(null);
      setLocationError("Bu konum için liste bulunmuyor. İzmir veya İstanbul’u seçebilir ya da haritadan başka bir nokta belirleyebilirsiniz.");
      return;
    }
    setPosition(match);
    setSearchValue({ city: match.city, value: "" });
    setTarget({ city: match.city, kind: "location", coordinates: match.coordinates });
    setLocationError(null);
    if (match.city !== city) router.push(pharmacyCityPath(match.city), { scroll: false });
  }, [city, router]);

  const pickLocation = useCallback((coordinates: Coordinates) => {
    cancelLocationRequest();
    applyPosition(coordinates, null);
  }, [applyPosition, cancelLocationRequest]);

  const changePicking = useCallback((enabled: boolean) => {
    if (enabled) {
      cancelLocationRequest();
      setLocationError(null);
    }
    setPicking(enabled);
  }, [cancelLocationRequest]);

  function locate() {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Bu tarayıcı konum bilgisi sağlayamıyor. Şehir seçebilir veya haritadan bir nokta belirleyebilirsiniz.");
      return;
    }
    setLocating(true);
    const request = ++locationRequest.current;
    const stillCurrent = () => locationRequest.current === request && window.location.pathname === pathname;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (locationRequest.current === request) setLocating(false);
      if (stillCurrent()) applyPosition([coords.longitude, coords.latitude], coords.accuracy);
    }, error => {
      if (locationRequest.current === request) setLocating(false);
      if (stillCurrent()) setLocationError(geolocationError(error.code));
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
  }

  function changeCity(next: PharmacyCity) {
    cancelLocationRequest();
    setPicking(false);
    setLocationError(null);
    setSelectedId(null);
    setSearchValue({ city: next, value: "" });
    setPosition(null);
    setTarget(null);
  }

  function changeQuery(value: string) {
    setSearchValue({ city, value });
    setSelectedId(null);
  }

  if (!city && pathname !== pharmacyPath) return children;

  const source: PharmacySource | null = feed.data?.source ?? (city ? pharmacyCities[city].source : null);
  const emptyMessage = !city ? "Bir şehir seçin veya konumunuzu kullanın."
    : feed.loading && !pharmacies.length ? "Liste hazırlanıyor…"
    : pharmacies.length ? "Aramanızla eşleşen eczane bulunamadı."
    : "Gösterilecek güncel eczane kaydı yok.";
  const locationText = activePosition ? [
    activePosition.accuracy === null ? "Haritadan seçilen nokta"
      : (activePosition.accuracy >= lowAccuracyMeters ? "Yaklaşık konum" : "Konumunuz") + " · ±" + formatDistance(activePosition.accuracy / 1000),
    activePosition.nearBoundary ? pharmacyCities[activePosition.city].name + " sınırına yakın" : null,
  ].filter(Boolean).join(" · ") : "";

  return (
    <>
      {children}
      <div className="pharmacy-toolbar">
        <button type="button" className="pharmacy-button pharmacy-button-primary pharmacy-locate" onClick={locate} disabled={locating}>
          <LocateFixed size={19} aria-hidden="true" />
          {locating ? "Konum aranıyor…" : "Yakınımdaki Eczaneleri Bul"}
        </button>
        <nav aria-label="Şehir seçimi" className="pharmacy-city-links">
          {pharmacyCitySlugs.map(slug => (
            <Link key={slug} href={pharmacyCityPath(slug)} prefetch={false} scroll={false}
              aria-current={city === slug ? "page" : undefined}
              onNavigate={event => city === slug ? event.preventDefault() : changeCity(slug)}>
              {pharmacyCities[slug].name}
            </Link>
          ))}
        </nav>
        <div className="pharmacy-search" role="search">
          <Search size={19} aria-hidden="true" />
          <label htmlFor="pharmacy-search" className="sr-only">İlçe, eczane veya adres ara</label>
          <input ref={search} id="pharmacy-search" type="search" value={query} onChange={event => changeQuery(event.target.value)}
            placeholder={city ? "İlçe, eczane veya adres" : "Aramak için şehir seçin"} autoComplete="off" spellCheck={false} maxLength={140} disabled={!city} />
          {query ? (
            <button type="button" className="pharmacy-icon-button" aria-label="Aramayı temizle" onClick={() => {
              changeQuery("");
              search.current?.focus();
            }}><X size={17} aria-hidden="true" /></button>
          ) : null}
        </div>
      </div>
      <div role="status">
        {locationError ? (
          <p className="pharmacy-location-message"><CircleAlert size={16} aria-hidden="true" />{locationError}</p>
        ) : null}
        {locationText ? (
          <p className="pharmacy-location-message"><LocateFixed size={16} aria-hidden="true" />{locationText}</p>
        ) : null}
      </div>
      {city ? <FeedStatus city={city} feed={feed} /> : null}

      <div className="pharmacy-workspace" data-results-first={Boolean(nearest.length || query)}>
        <div className="pharmacy-map-column">
          <PharmacyMap city={city} pharmacies={filtered} selectedId={selectionId ?? null} position={activePosition}
            target={target} nearby={query === deferredQuery ? nearbyCoordinates : emptyCoordinates} picking={picking}
            onSelect={choosePharmacy} onPickLocation={pickLocation} onPickingChange={changePicking} />
          <footer className="pharmacy-credits">
            <p>Harita <a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap katkıcıları</a></p>
          </footer>
        </div>
        <div className="pharmacy-panel">
          {selection && source ? (
            <PharmacyDetails {...selection} source={source} warning={!currentDutyList} headingRef={detailHeading} onClose={() => {
              setSelectedId(null);
              (selectionOrigin.current?.isConnected ? selectionOrigin.current : search.current)?.focus();
            }} />
          ) : null}
          <section className="pharmacy-results" aria-labelledby="pharmacy-results">
            <div className="pharmacy-results-heading">
              <h2 id="pharmacy-results" tabIndex={-1}>{nearest.length ? "Yakındaki eczaneler" : "Eczane listesi"}</h2>
              {results.length ? <p role="status">{nearest.length || results.length} sonuç</p> : null}
            </div>
            {results[0]?.distance != null ? (
              <p className="pharmacy-distance-note">Kuş uçuşu mesafeye göre sıralandı</p>
            ) : origin && results.length ? (
              <p className="pharmacy-distance-note">Bu sonuçlarda harita konumu bulunamadı.</p>
            ) : null}
            {nearest.length ? (
              <>
                <PharmacyList results={nearest} selectedId={selectionId ?? null} onSelect={choosePharmacy} directActions />
                <details className="pharmacy-all-results">
                  <summary>{query.trim() ? "Tüm arama sonuçları" : "Tüm eczaneler"} <span>{results.length}</span></summary>
                  <PharmacyList results={results} selectedId={selectionId ?? null} onSelect={choosePharmacy} />
                </details>
              </>
            ) : results.length ? (
              <PharmacyList results={results} selectedId={selectionId ?? null} onSelect={choosePharmacy} />
            ) : <p className="pharmacy-empty">{emptyMessage}</p>}
          </section>
        </div>
      </div>
    </>
  );
}
