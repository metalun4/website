import { provinceRings } from "./pharmacy-boundaries";
import { pharmacyCitySlugs, type PharmacyCity } from "./pharmacy-cities";
import { distanceKm, type Coordinates } from "./pharmacies";

export type SearchLocation = {
  city: PharmacyCity;
  coordinates: Coordinates;
  accuracy: number | null;
  nearBoundary: boolean;
};

const minimumBoundaryBufferKm = 1.5;
const maximumBoundaryBufferKm = 5;
export const lowAccuracyMeters = 1000;

// Natural Earth omits the inhabited Adalar islands at this scale.
// Approximate coverage around Büyükada, Heybeliada, Burgazada and Kınalıada.
const islandCoverage: Partial<Record<PharmacyCity, [Coordinates, number][]>> = {
  istanbul: [
    [[29.12, 40.858], 2.8],
    [[29.0917, 40.8778], 1.5],
    [[29.0618, 40.8799], 1.4],
    [[29.049, 40.909], 1.4],
  ],
};

function contains([x, y]: Coordinates, ring: Coordinates[]) {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1];
    const [bx, by] = ring[i];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function distanceToRing(point: Coordinates, ring: Coordinates[]) {
  // Project nearby longitude differences onto the local latitude before finding the closest point.
  const lngScale = Math.cos(point[1] * Math.PI / 180);
  let closest = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1];
    const b = ring[i];
    const dx = (b[0] - a[0]) * lngScale;
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) continue;
    const ratio = Math.max(0, Math.min(1, ((point[0] - a[0]) * lngScale * dx + (point[1] - a[1]) * dy) / lengthSquared));
    const projected: Coordinates = [a[0] + (b[0] - a[0]) * ratio, a[1] + dy * ratio];
    closest = Math.min(closest, distanceKm(point, projected));
  }
  return closest;
}

export function locatePharmacyCity(coordinates: Coordinates, reportedAccuracy: number | null): SearchLocation | null {
  const [lng, lat] = coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;

  const accuracy = reportedAccuracy !== null && Number.isFinite(reportedAccuracy) && reportedAccuracy >= 0 ? reportedAccuracy : null;
  const buffer = Math.max(minimumBoundaryBufferKm, Math.min(maximumBoundaryBufferKm, (accuracy ?? 0) / 1000));
  let nearest: { city: PharmacyCity; distance: number } | null = null;
  for (const city of pharmacyCitySlugs) {
    const rings = provinceRings[city];
    const islands = islandCoverage[city] ?? [];
    if (rings.some(ring => contains(coordinates, ring)) || islands.some(([center, radius]) => distanceKm(coordinates, center) <= radius)) {
      return { city, coordinates, accuracy, nearBoundary: false };
    }
    const distance = Math.min(...rings.map(ring => distanceToRing(coordinates, ring)));
    if (distance <= buffer && (!nearest || distance < nearest.distance)) nearest = { city, distance };
  }
  return nearest ? { city: nearest.city, coordinates, accuracy, nearBoundary: true } : null;
}

export function geolocationError(code: number) {
  switch (code) {
    case 1: return "Konum izni verilmedi. Şehir seçebilir veya haritadan bir nokta belirleyebilirsiniz.";
    case 3: return "Konum isteği zaman aşımına uğradı. Tekrar deneyebilir veya haritadan bir nokta seçebilirsiniz.";
    default: return "Konumunuz alınamadı. Tekrar deneyebilir veya haritadan bir nokta seçebilirsiniz.";
  }
}
