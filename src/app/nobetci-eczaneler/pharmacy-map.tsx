"use client";

import { List, Minus, Plus, Scan } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import type { FeatureCollection, Point } from "geojson";
import type { GeoJSONSource, Map as LibreMap, MapMouseEvent, Subscription } from "maplibre-gl";
import type { Coordinates, Pharmacy } from "@/lib/pharmacies";
import { pharmacyIcon } from "@/lib/pharmacy-icon";

const izmirCenter: Coordinates = [27.1428, 38.4237];
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
export type MapTarget = { coordinates: Coordinates; minZoom: number };

function selectedFilter(id: string | null): ["==", ["get", string], string] {
  return ["==", ["get", "pharmacyId"], id ?? ""];
}

function addPharmacyLayers(map: LibreMap, points: Points, visitor: Points, selectedId: string | null) {
  const theme = getComputedStyle(map.getContainer());
  const surface = theme.getPropertyValue("--surface").trim();
  const locationColor = theme.getPropertyValue("--chart-secondary").trim();

  map.addSource(pins, { type: "geojson", data: points, cluster: true, clusterRadius: 31, clusterMaxZoom: 11 });
  map.addSource(location, { type: "geojson", data: visitor });

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
    id: "visitor-halo", type: "circle", source: location,
    paint: { "circle-radius": 14, "circle-color": locationColor, "circle-opacity": 0.28 },
  });
  map.addLayer({
    id: location, type: "circle", source: location,
    paint: {
      "circle-radius": 6, "circle-color": locationColor, "circle-stroke-width": 2, "circle-stroke-color": surface,
    },
  });
}

function fitPoints(map: LibreMap, points: Points) {
  const first = points.features[0]?.geometry.coordinates;
  if (!first) {
    map.jumpTo({ center: izmirCenter, zoom: 9.2 });
    return;
  }

  const southwest: Coordinates = [first[0], first[1]];
  const northeast: Coordinates = [...southwest];
  for (const { geometry: { coordinates: [lng, lat] } } of points.features) {
    southwest[0] = Math.min(southwest[0], lng);
    southwest[1] = Math.min(southwest[1], lat);
    northeast[0] = Math.max(northeast[0], lng);
    northeast[1] = Math.max(northeast[1], lat);
  }
  const compact = map.getContainer().clientWidth < 570;
  map.fitBounds([southwest, northeast], {
    padding: { top: compact ? 105 : 70, right: 35, bottom: 66, left: 35 },
    maxZoom: 14,
    duration: 0,
  });
}

type Props = {
  pharmacies: Pharmacy[];
  selectedId: string | null;
  userLocation: Coordinates | null;
  target: MapTarget | null;
  onSelect: (id: string) => void;
  children: ReactNode;
};

export function PharmacyMap({ pharmacies, selectedId, userLocation, target, onSelect, children }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const fitted = useRef(false);
  const lastTarget = useRef<MapTarget | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const points = useMemo<Points>(() => ({
    type: "FeatureCollection",
    features: pharmacies.flatMap(({ coordinates, id }) => coordinates ? [{
      type: "Feature", geometry: { type: "Point", coordinates }, properties: { pharmacyId: id },
    }] : []),
  }), [pharmacies]);
  const visitor = useMemo<Points>(() => ({
    type: "FeatureCollection",
    features: userLocation ? [{
      type: "Feature", geometry: { type: "Point", coordinates: userLocation }, properties: {},
    }] : [],
  }), [userLocation]);

  const updateCamera = useEffectEvent((map: LibreMap) => {
    if (target && target !== lastTarget.current) {
      lastTarget.current = target;
      fitted.current = true;
      map.easeTo({ center: target.coordinates, zoom: Math.max(map.getZoom(), target.minZoom), duration: 320 });
    } else if (!fitted.current && points.features.length) {
      fitted.current = true;
      fitPoints(map, points);
    }
  });

  const installLayers = useEffectEvent((map: LibreMap) => {
    addPharmacyLayers(map, points, visitor, selectedId);
    updateCamera(map);
  });

  const selectOnMap = useEffectEvent(onSelect);

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
        container: element,
        style: styleUrl(),
        center: izmirCenter,
        zoom: 9.2,
        minZoom: 5,
        maxZoom: 19,
        maxPitch: 0,
        attributionControl: false,
        dragRotate: false,
        touchPitch: false,
        scrollZoom: false,
        renderWorldCopies: false,
        locale: { "Map.Title": "İzmir nöbetçi eczane haritası" },
      });
      map = mapRef.current = instance;
      instance.touchZoomRotate.disableRotation();
      instance.getCanvas().setAttribute("aria-describedby", "pharmacy-map-help");
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
        instance.on("dragstart", () => { fitted.current = true; }),
        instance.on("mousemove", event => {
          const overPoint = instance.getLayer(pins) && instance.queryRenderedFeatures(event.point, { layers: [pins, clusters] }).length;
          instance.getCanvas().style.cursor = overPoint ? "pointer" : "";
        }),
        instance.on("click", (event: MapMouseEvent) => {
          if (!instance.getLayer(pins)) return;
          const { x, y } = event.point;
          const options = { layers: [pins, clusters] };
          const hit = instance.queryRenderedFeatures(event.point, options)[0]
            ?? instance.queryRenderedFeatures([[x - 13, y - 13], [x + 13, y + 13]], options)[0];
          if (!hit) return;
          const id = hit.properties.pharmacyId;
          if (typeof id === "string") {
            selectOnMap(id);
          } else if (typeof hit.properties.cluster_id === "number" && hit.geometry.type === "Point") {
            const coordinates = hit.geometry.coordinates as Coordinates;
            const source = instance.getSource<GeoJSONSource>(pins);
            void source?.getClusterExpansionZoom(hit.properties.cluster_id).then(zoom => {
              if (!disposed && instance.getSource(pins) === source) instance.easeTo({ center: coordinates, zoom, duration: 320 });
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
    const map = mapRef.current;
    map?.getSource<GeoJSONSource>(pins)?.setData(points);
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getSource(pins)) updateCamera(map);
  }, [points, target]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(selected)) map.setFilter(selected, selectedFilter(selectedId));
  }, [selectedId]);

  useEffect(() => {
    mapRef.current?.getSource<GeoJSONSource>(location)?.setData(visitor);
  }, [visitor]);

  return (
    <div className="pharmacy-map">
      {children}
      <div className="pharmacy-map-canvas" ref={container} />
      <p className="sr-only" id="pharmacy-map-help">Ok tuşlarıyla haritayı kaydırın. Eczane seçmek için eczane listesini de kullanabilirsiniz.</p>
      {status === "loading" ? <p className="pharmacy-map-message" role="status">Harita yükleniyor…</p> : null}
      {status === "error" ? (
        <p className="pharmacy-map-message" role="status">Harita açılamadı. Eczaneleri listeden inceleyebilirsiniz.</p>
      ) : null}
      <div className="pharmacy-map-controls">
        <a className="pharmacy-button pharmacy-list-shortcut" href="#pharmacy-results">
          <List size={17} aria-hidden="true" /> Liste
        </a>
        <div className="pharmacy-zoom" aria-label="Harita denetimleri" role="group">
          <button type="button" aria-label="Sonuçları haritaya sığdır" title="Sonuçları haritaya sığdır" disabled={status !== "ready"} onClick={() => {
            if (mapRef.current) {
              fitted.current = true;
              fitPoints(mapRef.current, points);
            }
          }}><Scan size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Yakınlaştır" title="Yakınlaştır" disabled={status !== "ready"} onClick={() => mapRef.current?.zoomIn({ duration: 180 })}>
            <Plus size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Uzaklaştır" title="Uzaklaştır" disabled={status !== "ready"} onClick={() => mapRef.current?.zoomOut({ duration: 180 })}>
            <Minus size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
