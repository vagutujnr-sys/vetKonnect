import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { DvsRabiesCase } from "@/types";
import { getMapboxToken } from "@/lib/mapbox";

type Props = {
  cases: DvsRabiesCase[];
  className?: string;
};

const STATUS_COLOR: Record<string, string> = {
  confirmed: "#b91c1c",
  suspected: "#d97706",
  negative: "#0f766e",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function DvsRabiesMap({ cases, className }: Props) {
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
        style: "mapbox://styles/mapbox/streets-v12",
        center: [29.85, -19.02],
        zoom: 5.5,
      });
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

      const bounds = new mapboxgl.LngLatBounds();
      let hasBounds = false;
      let fitted = false;

      const fitToCases = () => {
        if (!map || !hasBounds || fitted) return;
        const width = el.clientWidth;
        const height = el.clientHeight;
        if (width < 80 || height < 80) return;
        const pad = Math.min(64, Math.floor(Math.min(width, height) / 8));
        map.fitBounds(bounds, { padding: pad, maxZoom: 6.8, duration: 0 });
        fitted = true;
      };

      map.on("load", () => {
        map?.resize();
        fitToCases();
      });

      resizeObserver = new ResizeObserver(() => {
        map?.resize();
        fitToCases();
      });
      resizeObserver.observe(el);

      for (const item of cases) {
        if (item.latitude == null || item.longitude == null) continue;
        if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;

        const color = STATUS_COLOR[item.status] ?? "#334155";
        const size = item.status === "confirmed" ? 18 : 14;
        const markerEl = document.createElement("button");
        markerEl.type = "button";
        markerEl.style.cssText = [
          `width:${size}px`,
          `height:${size}px`,
          "border-radius:9999px",
          `background:${color}`,
          item.status === "confirmed" ? "box-shadow:0 0 0 6px rgba(185,28,28,0.28)" : "box-shadow:0 1px 4px rgba(15,23,42,0.35)",
          "border:2px solid #fff",
          "cursor:pointer",
          "padding:0",
        ].join(";");
        markerEl.setAttribute("aria-label", `${item.status} rabies case at ${item.locationLabel ?? item.district ?? "unknown"}`);

        const when = item.reportedAt ? new Date(item.reportedAt).toLocaleDateString("en-GB") : "";
        const marker = new mapboxgl.Marker({ element: markerEl })
          .setLngLat([item.longitude, item.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 14, maxWidth: "280px" }).setHTML(
              `<div style="font:13px/1.45 system-ui,sans-serif;color:#0f172a">
                <strong>${escapeHtml(item.locationLabel || item.district || "Rabies case")}</strong>
                <div style="margin-top:4px;text-transform:capitalize;font-weight:600;color:${color}">${escapeHtml(item.status)}</div>
                <div>${escapeHtml(item.species ?? "Animal")} · ${escapeHtml(item.vaccinationStatus ?? "vaccination unknown")}</div>
                <div style="color:#475569">${escapeHtml(item.province ?? "")}${item.district ? ` · ${escapeHtml(item.district)}` : ""}</div>
                ${item.petName ? `<div>${escapeHtml(item.petName)}</div>` : ""}
                ${item.notes ? `<div style="margin-top:6px;color:#334155">${escapeHtml(item.notes)}</div>` : ""}
                ${when ? `<div style="margin-top:6px;color:#64748b">${escapeHtml(when)}</div>` : ""}
              </div>`,
            ),
          )
          .addTo(map!);
        markers.push(marker);
        bounds.extend([item.longitude, item.latitude]);
        hasBounds = true;
      }

      fitToCases();
    }

    void boot();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markers.forEach((m) => m.remove());
      map?.remove();
    };
  }, [cases, token]);

  if (!token) {
    return (
      <div
        className={`flex h-full min-h-[360px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600 ${className ?? ""}`}
      >
        Add `VITE_MAPBOX_ACCESS_TOKEN` to enable the rabies case map.
      </div>
    );
  }

  return <div ref={containerRef} className={`h-full min-h-[360px] w-full overflow-hidden ${className ?? ""}`} />;
}
