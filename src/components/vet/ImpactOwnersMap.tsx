import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { PotentialClient } from "@/types";
import type { GeoPoint } from "@/lib/geo";
import { getMapboxToken } from "@/lib/mapbox";

type Props = {
  vetLocation: GeoPoint;
  owners: PotentialClient[];
  selectedId?: string | null;
  onSelect?: (owner: PotentialClient | null) => void;
  className?: string;
};

function buildOwnerMarker(owner: PotentialClient, active: boolean): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = [
    "vk-impact-count-marker",
    active ? "vk-impact-count-marker-active" : "",
    owner.animals > 5 ? "vk-impact-count-marker-high-count" : "",
  ]
    .filter(Boolean)
    .join(" ");
  el.setAttribute(
    "aria-label",
    `${owner.herdAnimals} herded and ${owner.pets} pets at this location, ${owner.distanceKm.toFixed(1)} km away`,
  );
  el.textContent = owner.animals > 99 ? "99+" : String(owner.animals);
  return el;
}

export function ImpactOwnersMap({ vetLocation, owners, selectedId, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const ownerElsRef = useRef(new Map<string, HTMLButtonElement>());
  onSelectRef.current = onSelect;

  useEffect(() => {
    const token = getMapboxToken();
    const container = containerRef.current;
    if (!token || !container) return;

    let disposed = false;
    let map: import("mapbox-gl").Map | null = null;
    const markers: import("mapbox-gl").Marker[] = [];
    ownerElsRef.current = new Map();

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
        center: [vetLocation.longitude, vetLocation.latitude],
        zoom: 12.2,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

      const vetEl = document.createElement("div");
      vetEl.className = "vk-user-marker";
      vetEl.innerHTML = `<span></span>`;
      markers.push(
        new mapboxgl.Marker({ element: vetEl })
          .setLngLat([vetLocation.longitude, vetLocation.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(`<strong>Your practice</strong>`))
          .addTo(map),
      );

      const bounds = new mapboxgl.LngLatBounds(
        [vetLocation.longitude, vetLocation.latitude],
        [vetLocation.longitude, vetLocation.latitude],
      );

      // Closest owners first for marker stacking / fit.
      const closest = [...owners].sort((a, b) => a.distanceKm - b.distanceKm);

      closest.forEach((owner) => {
        const el = buildOwnerMarker(owner, owner.id === selectedId);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current?.(owner);
        });
        ownerElsRef.current.set(owner.id, el);

        const animalLabel = `${owner.herdAnimals} Herded and ${owner.pets} Pets`;
        const approx = owner.approximate ? "<br/><em>Approx. nearby</em>" : "";
        markers.push(
          new mapboxgl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([owner.longitude, owner.latitude])
            .setPopup(
              new mapboxgl.Popup({ offset: 28 }).setHTML(
                `<strong>${animalLabel}</strong><br/>${owner.distanceKm.toFixed(1)} km away${approx}`,
              ),
            )
            .addTo(map!),
        );
        bounds.extend([owner.longitude, owner.latitude]);
      });

      if (closest.length > 0) {
        map.fitBounds(bounds, {
          padding: { top: 96, bottom: 140, left: 48, right: 48 },
          maxZoom: 13.8,
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
      ownerElsRef.current = new Map();
    };
    // selectedId intentionally omitted — active state updated below without remounting the map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owners, vetLocation.latitude, vetLocation.longitude]);

  useEffect(() => {
    ownerElsRef.current.forEach((el, id) => {
      el.classList.toggle("vk-impact-count-marker-active", id === selectedId);
    });
  }, [selectedId]);

  if (!getMapboxToken()) {
    return (
      <div className="flex h-full items-center justify-center bg-accent/40 px-6 text-center text-sm text-muted-foreground">
        Add `VITE_MAPBOX_ACCESS_TOKEN` to enable the Impact owners map.
      </div>
    );
  }

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
