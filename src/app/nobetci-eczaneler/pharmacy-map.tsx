"use client";

import { Crosshair, Minus, Plus, Scan, X } from "lucide-react";
import { memo, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Point, Polygon } from "geojson";
import type { GeoJSONSource, Map as LibreMap, MapMouseEvent, Subscription } from "maplibre-gl";
import { pharmacyCities, type PharmacyCity } from "@/lib/pharmacy-cities";
import type { SearchLocation } from "@/lib/pharmacy-geography";
import type { Coordinates, Pharmacy } from "@/lib/pharmacies";
import { pharmacyIcon } from "@/lib/pharmacy-icon";

const overviewCenter: Coordinates = [28.2, 39.7];
const styles = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/fiord",
};
const pins = "duty-pharmacies";
const clusters = "duty-clusters";
const selected = "duty-selection";
const location = "visitor-location";
const pinImage = "pharmacy-letter";

type Points = FeatureCollection<Point>;
type Visitor = FeatureCollection<Point | Polygon>;
export type MapTarget = { city: PharmacyCity; kind: "location" | "pharmacy"; coordinates: Coordinates };

type CameraState = {
  city?: PharmacyCity | null;
  target: MapTarget | null;
  moved: boolean;
  fittedNearby: boolean;
  revision: number;
};

function recordManualMove(view: CameraState) {
  view.moved = true;
  view.revision++;
  return view.revision;
}

function selectedFilter(id: string | null): ["==", ["get", string], string] {
  return ["==", ["get", "pharmacyId"], id ?? ""];
}

function accuracyRing([longitude, latitude]: Coordinates, accuracy: number) {
  const radians = Math.PI / 180;
  const angle = accuracy / 6371000;
  const lat = latitude * radians;
  const ring: Coordinates[] = [];
  for (let i = 0; i < 48; i++) {
    const bearing = i * Math.PI / 24;
    const nextLat = Math.asin(Math.sin(lat) * Math.cos(angle) + Math.cos(lat) * Math.sin(angle) * Math.cos(bearing));
    const deltaLng = Math.atan2(Math.sin(bearing) * Math.sin(angle) * Math.cos(lat), Math.cos(angle) - Math.sin(lat) * Math.sin(nextLat));
    ring.push([longitude + deltaLng / radians, nextLat / radians]);
  }
  return [...ring, ring[0]];
}

function visitorFeatures(position: SearchLocation | null): Visitor {
  const data: Visitor = { type: "FeatureCollection", features: [] };
  if (!position) return data;
  const { coordinates, accuracy } = position;
  data.features.push({ type: "Feature", geometry: { type: "Point", coordinates }, properties: {} });
  if (accuracy && accuracy <= 50000) {
    data.features.push({ type: "Feature", geometry: { type: "Polygon", coordinates: [accuracyRing(coordinates, accuracy)] }, properties: {} });
  }
  return data;
}

function addPharmacyLayers(map: LibreMap, points: Points, visitor: Visitor, selectedId: string | null) {
  const theme = getComputedStyle(map.getContainer());
  const surface = theme.getPropertyValue("--surface").trim();
  const locationColor = theme.getPropertyValue("--chart-secondary").trim();

  map.addSource(pins, { type: "geojson", data: points, cluster: true, clusterRadius: 35, clusterMaxZoom: 11 });
  map.addSource(location, { type: "geojson", data: visitor });
  map.addLayer({
    id: "visitor-accuracy", type: "fill", source: location, filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": locationColor, "fill-opacity": 0.16, "fill-outline-color": locationColor },
  });
  map.addLayer({
    id: clusters, type: "circle", source: pins, filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["step", ["get", "point_count"], 14, 10, 17, 30, 20],
      "circle-color": pharmacyIcon.red, "circle-stroke-color": pharmacyIcon.white, "circle-stroke-width": 2.5,
    },
  });
  map.addLayer({
    id: "duty-cluster-label", type: "symbol", source: pins, filter: ["has", "point_count"],
    layout: {
      "text-field": ["to-string", ["get", "point_count"]],
      "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true,
    },
    paint: { "text-color": pharmacyIcon.white },
  });
  map.addLayer({
    id: selected, type: "circle", source: pins, filter: selectedFilter(selectedId),
    paint: {
      "circle-radius": 16, "circle-color": pharmacyIcon.white,
      "circle-stroke-color": pharmacyIcon.red, "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: pins, type: "circle", source: pins, filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 10, "circle-color": pharmacyIcon.red, "circle-stroke-color": pharmacyIcon.white, "circle-stroke-width": 2,
    },
  });

  const image = document.createElement("canvas");
  image.width = image.height = 24;
  const context = image.getContext("2d");
  if (context) {
    context.fillStyle = pharmacyIcon.white;
    context.fill(new Path2D(pharmacyIcon.path));
    map.addImage(pinImage, context.getImageData(0, 0, 24, 24), { pixelRatio: 1.5 });
    map.addLayer({
      id: "duty-pin-symbol", type: "symbol", source: pins, filter: ["!", ["has", "point_count"]],
      layout: { "icon-image": pinImage, "icon-allow-overlap": true },
    });
  }
  map.addLayer({
    id: location, type: "circle", source: location, filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 6, "circle-color": locationColor, "circle-stroke-width": 2, "circle-stroke-color": surface,
    },
  });
}

function duration(ms = 320) {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

function fitPoints(map: LibreMap, points: Coordinates[], maxZoom: number) {
  if (!points.length) return;
  const southwest: Coordinates = [...points[0]];
  const northeast: Coordinates = [...points[0]];
  for (const [lng, lat] of points) {
    southwest[0] = Math.min(southwest[0], lng);
    southwest[1] = Math.min(southwest[1], lat);
    northeast[0] = Math.max(northeast[0], lng);
    northeast[1] = Math.max(northeast[1], lat);
  }
  map.fitBounds([southwest, northeast], {
    padding: { top: 35, bottom: 64, left: 35, right: 64 }, maxZoom, duration: duration(),
  });
}

type Props = {
  city: PharmacyCity | null;
  pharmacies: Pharmacy[];
  selectedId: string | null;
  position: SearchLocation | null;
  target: MapTarget | null;
  nearby: Coordinates[];
  picking: boolean;
  onSelect: (id: string, origin: HTMLElement) => void;
  onPickLocation: (coordinates: Coordinates) => void;
  onPickingChange: (enabled: boolean) => void;
};

export const PharmacyMap = memo(function PharmacyMap({
  city, pharmacies, selectedId, position, target, nearby, picking, onSelect, onPickLocation, onPickingChange,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const pickButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const camera = useRef<CameraState>({
    target: null, moved: false, fittedNearby: false, revision: 0,
  });

  const points = useMemo<Points>(() => ({
    type: "FeatureCollection",
    features: pharmacies.flatMap(({ coordinates, id }) => coordinates ? [{
      type: "Feature", geometry: { type: "Point", coordinates }, properties: { pharmacyId: id },
    }] : []),
  }), [pharmacies]);
  const visitor = useMemo(() => visitorFeatures(position), [position]);

  const overview = useEffectEvent((map: LibreMap) => {
    const settings = city ? pharmacyCities[city] : null;
    const compact = map.getContainer().clientWidth < 550;
    map.jumpTo({ center: settings?.center ?? overviewCenter, zoom: (settings?.zoom ?? 6.65) - (compact ? 0.65 : 0) });
  });

  const updateCamera = useEffectEvent((map: LibreMap) => {
    const view = camera.current;
    const focus = target?.city === city ? target : null;
    if (view.city !== city) {
      view.city = city;
      view.target = null;
      view.revision++;
      map.getCanvas().setAttribute("aria-label", city ? pharmacyCities[city].name + " nöbetçi eczane haritası" : "Nöbetçi eczane haritası");
      if (!focus) overview(map);
    }
    if (focus !== view.target) {
      view.target = focus;
      view.revision++;
      view.moved = picking;
      view.fittedNearby = false;
      if (!picking && focus && (focus.kind === "pharmacy" || !nearby.length)) {
        const zoom = focus.kind === "pharmacy" ? 14 : 13;
        map.easeTo({ center: focus.coordinates, zoom: Math.max(map.getZoom(), zoom), duration: duration() });
      }
    }
    if (focus?.kind === "location" && nearby.length && !view.fittedNearby && !view.moved && !picking) {
      view.fittedNearby = true;
      fitPoints(map, [focus.coordinates, ...nearby], 14);
    }
  });

  const installLayers = useEffectEvent((map: LibreMap) => {
    addPharmacyLayers(map, points, visitor, selectedId);
    updateCamera(map);
  });

  function pickLocation(coordinates: Coordinates) {
    pickButton.current?.focus({ preventScroll: true });
    onPickLocation(coordinates);
  }
  const selectOnMap = useEffectEvent((id: string, origin: HTMLElement) => onSelect(id, origin));
  const handleMapPick = useEffectEvent((event: MapMouseEvent) => {
    if (!picking) return false;
    pickLocation([event.lngLat.lng, event.lngLat.lat]);
    return true;
  });
  const isPicking = useEffectEvent(() => picking);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let map: LibreMap | undefined;
    let loadTimeout = window.setTimeout(() => setStatus("error"), 12000);
    const subscriptions: Subscription[] = [];
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const styleUrl = () => dark.matches ? styles.dark : styles.light;
    const waitForStyle = () => {
      window.clearTimeout(loadTimeout);
      setStatus("loading");
      loadTimeout = window.setTimeout(() => setStatus("error"), 12000);
    };
    const onThemeChange = () => {
      waitForStyle();
      map?.setStyle(styleUrl(), { diff: false });
    };

    void import("maplibre-gl").then(({ Map, setWorkerUrl }) => {
      if (disposed) return;
      setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
      const instance = new Map({
        container: element, style: styleUrl(), center: overviewCenter, zoom: 6.65,
        minZoom: 5, maxZoom: 19, maxPitch: 0,
        attributionControl: false, dragRotate: false, touchPitch: false, scrollZoom: false, renderWorldCopies: false,
        locale: { "Map.Title": "Nöbetçi eczane haritası" },
      });
      map = mapRef.current = instance;
      instance.touchZoomRotate.disableRotation();
      instance.getCanvas().setAttribute("aria-describedby", "pharmacy-map-help");
      updateCamera(instance);
      waitForStyle();
      dark.addEventListener("change", onThemeChange);
      subscriptions.push(
        instance.on("webglcontextlost", waitForStyle),
        instance.on("style.load", () => installLayers(instance)),
        instance.on("idle", () => {
          if (!instance.getLayer(pins)) return;
          window.clearTimeout(loadTimeout);
          setStatus("ready");
        }),
        instance.on("movestart", event => {
          if (event.originalEvent) recordManualMove(camera.current);
        }),
        instance.on("mousemove", event => {
          const overPoint = instance.getLayer(pins) && instance.queryRenderedFeatures(event.point, { layers: [pins, clusters] }).length;
          instance.getCanvas().style.cursor = isPicking() ? "crosshair" : overPoint ? "pointer" : "";
        }),
        instance.on("click", (event: MapMouseEvent) => {
          if (handleMapPick(event) || !instance.getLayer(pins)) return;
          const { x, y } = event.point;
          const options = { layers: [pins, clusters] };
          const hit = instance.queryRenderedFeatures(event.point, options)[0]
            ?? instance.queryRenderedFeatures([[x - 13, y - 13], [x + 13, y + 13]], options)[0];
          if (!hit) return;
          const id = hit.properties.pharmacyId;
          if (typeof id === "string") {
            selectOnMap(id, instance.getCanvas());
          } else if (typeof hit.properties.cluster_id === "number" && hit.geometry.type === "Point") {
            const revision = recordManualMove(camera.current);
            const coordinates = hit.geometry.coordinates as Coordinates;
            const source = instance.getSource<GeoJSONSource>(pins);
            void source?.getClusterExpansionZoom(hit.properties.cluster_id).then(zoom => {
              if (!disposed && !isPicking() && camera.current.revision === revision && instance.getSource(pins) === source) {
                instance.easeTo({ center: coordinates, zoom, duration: duration() });
              }
            }).catch(() => {});
          }
        }),
      );
    }).catch(() => {
      window.clearTimeout(loadTimeout);
      if (!disposed) setStatus("error");
    });

    return () => {
      disposed = true;
      window.clearTimeout(loadTimeout);
      dark.removeEventListener("change", onThemeChange);
      for (const subscription of subscriptions) subscription.unsubscribe();
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    camera.current.revision++;
    mapRef.current?.getSource<GeoJSONSource>(pins)?.setData(points);
  }, [points]);

  useEffect(() => {
    if (mapRef.current) updateCamera(mapRef.current);
  }, [city, target, nearby, picking]);

  useEffect(() => {
    camera.current.revision++;
    const map = mapRef.current;
    if (map?.getLayer(selected)) map.setFilter(selected, selectedFilter(selectedId));
  }, [selectedId]);

  useEffect(() => {
    mapRef.current?.getSource<GeoJSONSource>(location)?.setData(visitor);
  }, [visitor]);

  useEffect(() => {
    if (picking) confirmButton.current?.focus({ preventScroll: true });
  }, [picking]);

  function moveMap(move: (map: LibreMap) => void) {
    if (!mapRef.current) return;
    recordManualMove(camera.current);
    move(mapRef.current);
  }

  return (
    <div className="pharmacy-map" data-map-state={status}>
      <div className="pharmacy-map-canvas" ref={container} />
      <p className="sr-only" id="pharmacy-map-help">
        Ok tuşlarıyla haritayı kaydırın. Eczane seçmek için listeyi kullanabilirsiniz. Konum seçmek için harita merkezini kullanın.
      </p>
      {status === "loading" ? <p className="pharmacy-map-message" role="status">Harita yükleniyor…</p> : null}
      {status === "error" ? <p className="pharmacy-map-message" role="status">Harita açılamadı. Eczaneleri listeden inceleyebilirsiniz.</p> : null}
      <div className="pharmacy-zoom" aria-label="Harita denetimleri" role="group">
        <button type="button" aria-label="Eczaneleri haritaya sığdır" title="Eczaneleri haritaya sığdır"
          disabled={status !== "ready" || !points.features.length}
          onClick={() => moveMap(map => fitPoints(map, points.features.map(feature => feature.geometry.coordinates as Coordinates), 14))}>
          <Scan size={18} aria-hidden="true" />
        </button>
        <button type="button" aria-label="Yakınlaştır" title="Yakınlaştır" disabled={status !== "ready"}
          onClick={() => moveMap(map => map.zoomIn({ duration: duration(180) }))}><Plus size={18} aria-hidden="true" /></button>
        <button type="button" aria-label="Uzaklaştır" title="Uzaklaştır" disabled={status !== "ready"}
          onClick={() => moveMap(map => map.zoomOut({ duration: duration(180) }))}><Minus size={18} aria-hidden="true" /></button>
      </div>
      {picking ? <span className="pharmacy-map-crosshair" aria-hidden="true"><Crosshair size={27} /></span> : null}
      <div className="pharmacy-map-controls">
        {picking ? (
          <>
            <p id="pharmacy-pick-help">Haritayı kaydırıp merkezdeki noktayı seçin.</p>
            <button className="pharmacy-button pharmacy-button-primary" type="button" ref={confirmButton} disabled={status !== "ready"}
              aria-describedby="pharmacy-pick-help"
              onClick={() => {
                const center = mapRef.current?.getCenter();
                if (center) pickLocation([center.lng, center.lat]);
              }}>
              Bu bölgede ara
            </button>
          </>
        ) : null}
        <button className="pharmacy-button" type="button" ref={pickButton} aria-pressed={picking} disabled={status !== "ready"}
          onClick={() => {
            if (!picking) moveMap(map => map.stop());
            onPickingChange(!picking);
          }}>
          {picking ? <X size={17} aria-hidden="true" /> : <Crosshair size={17} aria-hidden="true" />}
          {picking ? "İptal" : "Haritadan konum seç"}
        </button>
      </div>
    </div>
  );
});
