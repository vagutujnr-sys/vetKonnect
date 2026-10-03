import { useEffect, useMemo, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  buildProvinceDemographics,
  lensColor,
  lensMetric,
  summariseDemographics,
  type DemographicLens,
  type ProvinceDemographics,
  type RegistryCertificate,
  type RegistryLicence,
  type RegistryPet,
  type RegistryVaccination,
} from "@/lib/dvsDemographics";
import { getMapboxToken } from "@/lib/mapbox";
import { cn } from "@/lib/utils";

type Props = {
  pets: RegistryPet[];
  certificates: RegistryCertificate[];
  vaccinations: RegistryVaccination[];
  licences: RegistryLicence[];
  className?: string;
};

const LENSES: { id: DemographicLens; label: string }[] = [
  { id: "animals", label: "All animals" },
  { id: "dogs", label: "Dogs" },
  { id: "coverage", label: "Vaccination" },
  { id: "licensed", label: "Licences" },
  { id: "owners", label: "Households" },
];

function formatCount(value: number): string {
  return value.toLocaleString("en-ZW");
}

function advantages(summary: ReturnType<typeof summariseDemographics>) {
  const weakest = summary.weakest;
  return [
    {
      title: "One national register",
      body: `${formatCount(summary.animals)} animals across ${summary.provincesWithAnimals} provinces sit on a single map authorities can open in a briefing.`,
    },
    {
      title: "Rabies risk by place",
      body: weakest
        ? `${formatCount(summary.dogs)} dogs are ${summary.dogShare}% of the register. National rabies vaccination is ${summary.coveragePct}%, lowest in ${weakest.province} at ${weakest.coveragePct}%.`
        : "Dogs, the main rabies reservoir, appear by province as clinics record them, with vaccination coverage beside the count.",
    },
    {
      title: "Licence compliance is countable",
      body: `${formatCount(summary.licensed)} animals hold a current DVS licence (${summary.licencePct}%). ${formatCount(summary.unlicensed)} do not, so enforcement and fee collection start from a list.`,
    },
    {
      title: "Households, not only animals",
      body: `${formatCount(summary.owners)} owner households are linked to the animals in their province, so a campaign can reach the people who keep them.`,
    },
  ];
}

export function DvsBriefingMap({ pets, certificates, vaccinations, licences, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const token = getMapboxToken();
  const [lens, setLens] = useState<DemographicLens>("animals");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const rows = useMemo(
    () => buildProvinceDemographics({ pets, certificates, vaccinations, licences }),
    [pets, certificates, vaccinations, licences],
  );
  const summary = useMemo(() => summariseDemographics(rows), [rows]);
  const selected = rows.find((row) => row.province === selectedName) ?? rows.find((row) => row.animals > 0) ?? rows[0];
  const points = useMemo(() => advantages(summary), [summary]);
  const maxMetric = Math.max(...rows.map((row) => lensMetric(row, lens)), 1);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function boot() {
      const el = containerRef.current;
      if (!el) return;
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: el,
        style: "mapbox://styles/mapbox/light-v11",
        center: [29.85, -19.02],
        zoom: 5.45,
      });
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;
        map.resize();
        map.addSource("demographics", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "demographic-circles",
          type: "circle",
          source: "demographics",
          paint: {
            "circle-radius": ["get", "radius"],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.88,
            "circle-stroke-width": ["get", "stroke"],
            "circle-stroke-color": ["get", "strokeColor"],
          },
        });
        map.on("click", "demographic-circles", (event) => {
          const province = event.features?.[0]?.properties?.province;
          if (typeof province === "string") setSelectedName(province);
        });
        map.on("mouseenter", "demographic-circles", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "demographic-circles", () => {
          map.getCanvas().style.cursor = "";
        });
        map.resize();
        setMapReady(true);
      });

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(el);
      if (el.parentElement) resizeObserver.observe(el.parentElement);
    }

    void boot();
    return () => {
      cancelled = true;
      setMapReady(false);
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource("demographics") as import("mapbox-gl").GeoJSONSource | undefined;
    if (!source) return;
    const selectedProvince = selected?.province;
    source.setData({
      type: "FeatureCollection",
      features: rows.map((row) => {
        const metric = lensMetric(row, lens);
        const active = row.province === selectedProvince;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
          properties: {
            province: row.province,
            color: lensColor(metric, maxMetric, lens),
            radius: 16 + Math.round((Math.sqrt(row.animals) / Math.sqrt(Math.max(summary.animals, 1))) * 42),
            stroke: active ? 4 : 2,
            strokeColor: active ? "#123524" : "#ffffff",
          },
        };
      }),
    });
  }, [rows, lens, selected, mapReady, maxMetric, summary.animals]);

  if (!token) {
    return (
      <div className={cn("flex h-full min-h-[360px] items-center justify-center bg-slate-50 p-8 text-sm text-slate-600", className)}>
        Add VITE_MAPBOX_ACCESS_TOKEN to present the authority demographic map.
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-1 flex-col bg-slate-100 lg:relative lg:block", className)}>
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">VetKonnect for authorities</p>
        <h1 className="text-base font-bold text-slate-900">National animal demographics</h1>
      </header>

      <div className="relative h-[46dvh] w-full shrink-0 lg:absolute lg:inset-0 lg:h-full">
        <div ref={containerRef} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
          <div className="pointer-events-auto absolute left-4 top-4 w-[min(100%-2rem,340px)] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">VetKonnect for authorities</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">National animal demographics</h2>
            <p className="mt-1 text-xs leading-snug text-slate-500">
              Live register. Province comes from the certificate or vaccination record. Animals without a recorded province use a stable national assignment.
            </p>
            <LensBar lens={lens} onChange={setLens} className="mt-3 flex flex-wrap gap-1.5" />
            <NationalStats summary={summary} />
          </div>
          {selected ? (
            <div className="pointer-events-auto absolute right-4 top-4 max-h-[calc(100%-5.5rem)] w-[min(100%-2rem,360px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
              <ProvincePanel selected={selected} points={points} hint="Click another circle to compare provinces." />
            </div>
          ) : null}
          <div className="pointer-events-none absolute bottom-4 left-1/2 flex max-w-[calc(100%-8rem)] -translate-x-1/2 flex-wrap justify-center gap-x-3 gap-y-1 rounded-full bg-white/95 px-4 py-2 text-xs text-slate-700 shadow-sm">
            <MapLegend />
          </div>
        </div>
      </div>

      <section className="max-h-[58dvh] shrink-0 overflow-y-auto overscroll-contain border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <LensBar lens={lens} onChange={setLens} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" />
        <NationalStats summary={summary} />
        {selected ? <ProvincePanel selected={selected} points={points} hint="Tap another circle to compare provinces." /> : null}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          <MapLegend />
        </div>
      </section>
    </div>
  );
}

function LensBar({
  lens,
  onChange,
  className,
}: {
  lens: DemographicLens;
  onChange: (lens: DemographicLens) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      {LENSES.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "shrink-0 rounded-full px-3 py-2 text-xs font-semibold",
            lens === item.id ? "bg-[#123524] text-white" : "bg-slate-100 text-slate-700",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function NationalStats({ summary }: { summary: ReturnType<typeof summariseDemographics> }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
      <Stat label="Animals" value={formatCount(summary.animals)} />
      <Stat label="Dogs" value={`${formatCount(summary.dogs)} · ${summary.dogShare}%`} />
      <Stat label="Vaccinated" value={`${summary.coveragePct}%`} />
      <Stat label="Licensed" value={`${summary.licencePct}%`} />
      <Stat label="Households" value={formatCount(summary.owners)} />
      <Stat label="Unlicensed" value={formatCount(summary.unlicensed)} />
    </dl>
  );
}

function ProvincePanel({
  selected,
  points,
  hint,
}: {
  selected: ProvinceDemographics;
  points: { title: string; body: string }[];
  hint: string;
}) {
  return (
    <div className="mt-4 lg:mt-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">Selected province</p>
      <h3 className="mt-1 text-lg font-bold text-slate-900">{selected.province}</h3>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <ProvinceFacts row={selected} />
      <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why this map matters</p>
        {points.map((item) => (
          <div key={item.title}>
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-600">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapLegend() {
  return (
    <>
      <Legend swatch="#123524" label="Higher count" />
      <Legend swatch="#5eead4" label="Lower count" />
      <Legend swatch="#0f766e" label="70%+ coverage or licences" />
      <Legend swatch="#d97706" label="40–69%" />
      <Legend swatch="#b91c1c" label="Under 40%" />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-bold text-slate-900">{value}</dd>
    </div>
  );
}

function ProvinceFacts({ row }: { row: ProvinceDemographics }) {
  const items = [
    ["Animals", formatCount(row.animals)],
    ["Dogs", formatCount(row.dogs)],
    ["Cats", formatCount(row.cats)],
    ["Birds / other", formatCount(row.birds + row.other)],
    ["Male", formatCount(row.male)],
    ["Female", formatCount(row.female)],
    ["Under 2 years", formatCount(row.young)],
    ["2–7 years", formatCount(row.adult)],
    ["8 years and over", formatCount(row.senior)],
    ["Households", formatCount(row.owners)],
    ["Vaccinated", `${formatCount(row.vaccinated)} · ${row.coveragePct}%`],
    ["Licensed", `${formatCount(row.licensed)} · ${row.licencePct}%`],
  ];
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1">
          <dt className="text-slate-500">{label}</dt>
          <dd className="font-semibold text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: swatch }} />
      {label}
    </span>
  );
}
