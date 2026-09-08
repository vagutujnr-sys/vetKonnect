import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MappableVet } from "@/types";
import type { GeoPoint } from "@/lib/geo";
import { getMapboxToken } from "@/lib/mapbox";

type Props = {
  userLocation: GeoPoint;
  vets: MappableVet[];
  className?: string;
};

export function ClosestVetsMap({ userLocation, vets, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getMapboxToken();
    if (!token || !containerRef.current) return;

    let disposed = false;
    let map: import("mapbox-gl").Map | null = null;
    const markers: import("mapbox-gl").Marker[] = [];

    void (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (disposed || !containerRef.current) return;

      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 12,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

      const userEl = document.createElement("div");
      userEl.className = "vk-user-marker";
      userEl.innerHTML = `<span></span>`;
      markers.push(
        new mapboxgl.Marker({ element: userEl })
          .setLngLat([userLocation.longitude, userLocation.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(`<strong>You are here</strong>`))
          .addTo(map),
      );

      const bounds = new mapboxgl.LngLatBounds(
        [userLocation.longitude, userLocation.latitude],
        [userLocation.longitude, userLocation.latitude],
      );

      vets.forEach((vet, index) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "vk-vet-marker";
        el.textContent = String(index + 1);
        el.setAttribute("aria-label", vet.name);

        markers.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([vet.longitude, vet.latitude])
            .setPopup(
              new mapboxgl.Popup({ offset: 18 }).setHTML(
                `<strong>${vet.name}</strong><br/>${vet.surgery}<br/>${vet.distanceKm.toFixed(1)} km away`,
              ),
            )
            .addTo(map!),
        );
        bounds.extend([vet.longitude, vet.latitude]);
      });

      if (vets.length > 0) {
        map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 700 });
      }
    })();

    return () => {
      disposed = true;
      markers.forEach((marker) => marker.remove());
      map?.remove();
    };
  }, [userLocation.latitude, userLocation.longitude, vets]);

  if (!getMapboxToken()) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-border bg-white px-4 text-center text-sm text-muted-foreground">
        Add `VITE_MAPBOX_ACCESS_TOKEN` in `.env.local` and Vercel to enable the live map.
      </div>
    );
  }

  return <div ref={containerRef} className={className ?? "h-72 w-full overflow-hidden rounded-2xl"} />;
}
