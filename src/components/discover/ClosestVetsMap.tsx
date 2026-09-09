import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { MappableVet } from "@/types";
import type { GeoPoint } from "@/lib/geo";
import { getMapboxToken } from "@/lib/mapbox";

type Props = {
  userLocation: GeoPoint;
  vets: MappableVet[];
  selectedId?: string | null;
  onSelect?: (vet: MappableVet | null) => void;
  className?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function ClosestVetsMap({ userLocation, vets, selectedId, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const vetElsRef = useRef(new Map<string, HTMLButtonElement>());
  onSelectRef.current = onSelect;

  useEffect(() => {
    const token = getMapboxToken();
    const container = containerRef.current;
    if (!token || !container) return;

    let disposed = false;
    let map: import("mapbox-gl").Map | null = null;
    const markers: import("mapbox-gl").Marker[] = [];
    vetElsRef.current = new Map();

    const resizeMap = () => {
      map?.resize();
    };

    void (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (disposed || !containerRef.current) return;

      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 12.2,
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
        el.className =
          vet.id === selectedId ? "vk-vet-marker vk-vet-marker-active" : "vk-vet-marker";
        el.textContent = String(index + 1);
        el.setAttribute("aria-label", vet.name);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current?.(vet);
        });
        vetElsRef.current.set(vet.id, el);

        markers.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([vet.longitude, vet.latitude])
            .setPopup(
              new mapboxgl.Popup({ offset: 18 }).setHTML(
                `<strong>${escapeHtml(vet.name)}</strong><br/>${escapeHtml(vet.surgery)}<br/>${vet.distanceKm.toFixed(1)} km away`,
              ),
            )
            .addTo(map!),
        );
        bounds.extend([vet.longitude, vet.latitude]);
      });

      if (vets.length > 0) {
        map.fitBounds(bounds, {
          padding: { top: 96, bottom: 140, left: 48, right: 48 },
          maxZoom: 13.5,
          duration: 700,
        });
      }

      map.on("click", () => onSelectRef.current?.(null));
      map.once("load", resizeMap);
      requestAnimationFrame(resizeMap);
      window.setTimeout(resizeMap, 120);
    })();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeMap) : null;
    observer?.observe(container);
    window.addEventListener("resize", resizeMap);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("resize", resizeMap);
      markers.forEach((marker) => marker.remove());
      map?.remove();
      vetElsRef.current = new Map();
    };
    // selectedId intentionally omitted — active state updated below without remounting the map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation.latitude, userLocation.longitude, vets]);

  useEffect(() => {
    vetElsRef.current.forEach((el, id) => {
      el.classList.toggle("vk-vet-marker-active", id === selectedId);
    });
  }, [selectedId]);

  if (!getMapboxToken()) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center bg-accent/40 px-6 text-center text-sm text-muted-foreground">
        Add `VITE_MAPBOX_ACCESS_TOKEN` to enable the live vet map.
      </div>
    );
  }

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
