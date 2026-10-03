import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { DvsMapPoint } from "@/types";
import { getMapboxToken } from "@/lib/mapbox";

type Props = {
  points: DvsMapPoint[];
  className?: string;
};

const KIND_COLOR: Record<DvsMapPoint["kind"], string> = {
  coverage: "#0f766e",
  vaccination: "#2563eb",
  identified: "#ca8a04",
  rabies: "#dc2626",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function DvsGeoMap({ points, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const token = getMapboxToken();

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    let map: import("mapbox-gl").Map | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const markers: import("mapbox-gl").Marker[] = [];

    async function boot() {
      const el = containerRef.current;
      if (!el) return;

      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;

      mapboxgl.accessToken = token!;
      map = new mapboxgl.Map({
        container: el,
        style: "mapbox://styles/mapbox/light-v11",
        center: [29.85, -19.02],
        zoom: 5.4,
      });
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      map.on("load", () => map?.resize());

      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(el);

      const bounds = new mapboxgl.LngLatBounds();
      let hasBounds = false;

      for (const point of points) {
        const markerEl = document.createElement("button");
        markerEl.type = "button";
        const size = point.kind === "coverage" ? 18 : 14;
        markerEl.style.cssText = [
          `width:${size}px`,
          `height:${size}px`,
          "border-radius:9999px",
          `background:${KIND_COLOR[point.kind]}`,
          "border:2px solid #fff",
          "box-shadow:0 1px 4px rgba(15,23,42,0.35)",
          "cursor:pointer",
          "padding:0",
        ].join(";");
        markerEl.setAttribute("aria-label", point.label);

        const marker = new mapboxgl.Marker({ element: markerEl })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 12 }).setHTML(
              `<strong>${escapeHtml(point.label)}</strong><br/><span style="text-transform:capitalize">${escapeHtml(point.kind)}</span>${
                point.detail ? `<br/>${escapeHtml(point.detail)}` : ""
              }`,
            ),
          )
          .addTo(map!);
        markers.push(marker);
        bounds.extend([point.longitude, point.latitude]);
        hasBounds = true;
      }

      if (hasBounds) {
        map.fitBounds(bounds, { padding: 48, maxZoom: 8.5 });
      }
    }

    void boot();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markers.forEach((m) => m.remove());
      map?.remove();
    };
  }, [points, token]);

  if (!token) {
    return (
      <div
        className={`flex h-full min-h-[360px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600 ${className ?? ""}`}
      >
        Add `VITE_MAPBOX_ACCESS_TOKEN` to enable the national coverage map.
      </div>
    );
  }

  return <div ref={containerRef} className={`h-full min-h-[360px] w-full overflow-hidden ${className ?? ""}`} />;
}
