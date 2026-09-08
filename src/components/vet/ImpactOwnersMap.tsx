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

const PAW_SVG = `<svg class="vk-owner-marker-paw" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 10.5c-1.8 0-3.4 1.2-3.9 2.9-.4 1.3.1 2.7 1.2 3.5.7.5 1.6.8 2.7.8s2-.3 2.7-.8c1.1-.8 1.6-2.2 1.2-3.5-.5-1.7-2.1-2.9-3.9-2.9zm-5.2-1.2c.9 0 1.7-.8 1.7-1.8S7.7 5.7 6.8 5.7 5.1 6.5 5.1 7.5s.8 1.8 1.7 1.8zm10.4 0c.9 0 1.7-.8 1.7-1.8s-.8-1.8-1.7-1.8-1.7.8-1.7 1.8.8 1.8 1.7 1.8zM8.4 4.8c.9 0 1.6-.8 1.6-1.7S9.3 1.4 8.4 1.4 6.8 2.2 6.8 3.1s.7 1.7 1.6 1.7zm7.2 0c.9 0 1.6-.8 1.6-1.7s-.7-1.7-1.6-1.7-1.6.8-1.6 1.7.7 1.7 1.6 1.7z"/></svg>`;

function buildOwnerMarker(owner: PotentialClient, active: boolean): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = active ? "vk-owner-marker vk-owner-marker-active" : "vk-owner-marker";
  el.setAttribute("aria-label", `${owner.fullName}, ${owner.pets} pets`);

  const face = document.createElement("span");
  face.className = "vk-owner-marker-face";
  if (owner.avatarUrl) {
    const img = document.createElement("img");
    img.src = owner.avatarUrl;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    face.appendChild(img);
  } else {
    face.innerHTML = PAW_SVG;
  }

  const count = document.createElement("span");
  count.className = "vk-owner-marker-count";
  count.textContent = owner.pets > 9 ? "9+" : String(owner.pets);

  el.appendChild(face);
  el.appendChild(count);
  return el;
}

export function ImpactOwnersMap({ vetLocation, owners, selectedId, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const ownerElsRef = useRef(new Map<string, HTMLButtonElement>());
  onSelectRef.current = onSelect;

  useEffect(() => {
    const token = getMapboxToken();
    if (!token || !containerRef.current) return;

    let disposed = false;
    let map: import("mapbox-gl").Map | null = null;
    const markers: import("mapbox-gl").Marker[] = [];
    ownerElsRef.current = new Map();

    void (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (disposed || !containerRef.current) return;

      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [vetLocation.longitude, vetLocation.latitude],
        zoom: 12,
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

      owners.forEach((owner) => {
        const el = buildOwnerMarker(owner, owner.id === selectedId);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current?.(owner);
        });
        ownerElsRef.current.set(owner.id, el);

        const petsLabel = `${owner.pets} pet${owner.pets === 1 ? "" : "s"}`;
        const petNames = owner.petNames.slice(0, 3).join(", ");
        const approx = owner.approximate ? "<br/><em>Approx. nearby</em>" : "";
        markers.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([owner.longitude, owner.latitude])
            .setPopup(
              new mapboxgl.Popup({ offset: 22 }).setHTML(
                `<strong>${owner.fullName}</strong><br/>${petsLabel}${petNames ? ` · ${petNames}` : ""} · ${owner.distanceKm.toFixed(1)} km${approx}`,
              ),
            )
            .addTo(map!),
        );
        bounds.extend([owner.longitude, owner.latitude]);
      });

      if (owners.length > 0) {
        map.fitBounds(bounds, { padding: 72, maxZoom: 13.5, duration: 700 });
      }

      map.on("click", () => onSelectRef.current?.(null));

      // Ensure tiles paint after full-bleed layout settles.
      map.once("load", () => map?.resize());
      requestAnimationFrame(() => map?.resize());
    })();

    return () => {
      disposed = true;
      markers.forEach((marker) => marker.remove());
      map?.remove();
      ownerElsRef.current = new Map();
    };
    // selectedId intentionally omitted — active state updated below without remounting the map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owners, vetLocation.latitude, vetLocation.longitude]);

  useEffect(() => {
    ownerElsRef.current.forEach((el, id) => {
      el.classList.toggle("vk-owner-marker-active", id === selectedId);
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
