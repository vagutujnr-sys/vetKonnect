export type GeoPoint = { latitude: number; longitude: number };

export const HARARE: GeoPoint = { latitude: -17.8292, longitude: 31.0522 };

const CITY_COORDS: Record<string, GeoPoint> = {
  harare: HARARE,
  "harare central": { latitude: -17.8252, longitude: 31.0335 },
  borrowdale: { latitude: -17.7845, longitude: 31.0443 },
  bulawayo: { latitude: -20.1563, longitude: 28.5887 },
  kariba: { latitude: -16.5167, longitude: 28.8 },
};

export function coordsFromPlace(place?: string | null): GeoPoint | null {
  if (!place) return null;
  const key = place.trim().toLowerCase();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  for (const [name, point] of Object.entries(CITY_COORDS)) {
    if (key.includes(name)) return point;
  }
  return null;
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function getCurrentPosition(timeoutMs = 8000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
