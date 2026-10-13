import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import { COUNCIL_FEE_SCHEDULE } from "@/lib/councilRevenue";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

type RevenueAssumptions = {
  dogPopulationTarget: number;
  communityRate: number;
  standardRate: number;
  suburbRate: number;
  qualitySurcharge: number;
  annualLicenceRenewalPct: number;
  femaleLicenceSharePct: number;
  breedingLicences: number;
  breedingLicenceRate: number;
  chipCost: number;
  annualOperatingCost: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

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
  const [financeOpen, setFinanceOpen] = useState(false);
  const [financeOverrides, setFinanceOverrides] = useState<Partial<RevenueAssumptions>>({});

  const rows = useMemo(
    () => buildProvinceDemographics({ pets, certificates, vaccinations, licences }),
    [pets, certificates, vaccinations, licences],
  );
  const summary = useMemo(() => summariseDemographics(rows), [rows]);
  const selected = rows.find((row) => row.province === selectedName) ?? rows.find((row) => row.animals > 0) ?? rows[0];
  const points = useMemo(() => advantages(summary), [summary]);
  const maxMetric = Math.max(...rows.map((row) => lensMetric(row, lens)), 1);
  const defaultFinance = useMemo<RevenueAssumptions>(() => ({
    dogPopulationTarget: 200000,
    communityRate: 10,
    standardRate: 15,
    suburbRate: 20,
    qualitySurcharge: 10,
    annualLicenceRenewalPct: 60,
    femaleLicenceSharePct: 50,
    breedingLicences: 50,
    breedingLicenceRate: 50,
    chipCost: 5,
    annualOperatingCost: 30000,
  }), []);
  const finance = { ...defaultFinance, ...financeOverrides };
  const registeredDogs = Math.max(0, finance.dogPopulationTarget);
  const communityDogs = Math.round(registeredDogs * 0.4);
  const standardDogs = Math.round(registeredDogs * 0.35);
  const suburbDogs = Math.max(0, registeredDogs - communityDogs - standardDogs);
  const qualityDogs = Math.round(registeredDogs * 0.1);
  const registrationRevenue = communityDogs * finance.communityRate
    + standardDogs * finance.standardRate
    + suburbDogs * finance.suburbRate
    + qualityDogs * finance.qualitySurcharge;
  const annualLicenceCount = Math.round(registeredDogs * finance.annualLicenceRenewalPct / 100);
  const femaleLicenceCount = Math.round(annualLicenceCount * finance.femaleLicenceSharePct / 100);
  const maleLicenceCount = annualLicenceCount - femaleLicenceCount;
  const annualDogLicenceRevenue = maleLicenceCount * COUNCIL_FEE_SCHEDULE.dogMaleLicence
    + femaleLicenceCount * COUNCIL_FEE_SCHEDULE.dogFemaleLicence;
  const annualBreedingRevenue = finance.breedingLicences * finance.breedingLicenceRate;
  const recurringRevenue = annualDogLicenceRevenue + annualBreedingRevenue;
  const registrationCost = registeredDogs * finance.chipCost;
  const yearOneContribution = registrationRevenue + recurringRevenue - finance.annualOperatingCost - registrationCost;
  const threeYearContribution = registrationRevenue + recurringRevenue * 3
    - finance.annualOperatingCost * 3 - registrationCost;
  const revenueTimeline = [
    {
      year: "Year 1",
      registration: registrationRevenue,
      dogLicences: annualDogLicenceRevenue,
      breedingLicences: annualBreedingRevenue,
      contribution: yearOneContribution,
    },
    {
      year: "Year 2",
      registration: 0,
      dogLicences: annualDogLicenceRevenue,
      breedingLicences: annualBreedingRevenue,
      contribution: recurringRevenue - finance.annualOperatingCost,
    },
    {
      year: "Year 3",
      registration: 0,
      dogLicences: annualDogLicenceRevenue,
      breedingLicences: annualBreedingRevenue,
      contribution: recurringRevenue - finance.annualOperatingCost,
    },
  ];
  const provinceRevenue = rows
    .map((row) => {
      const dogsWithoutSex = Math.max(0, row.dogs - row.maleDogs - row.femaleDogs);
      const annualRevenue = row.maleDogs * COUNCIL_FEE_SCHEDULE.dogMaleLicence
        + row.femaleDogs * COUNCIL_FEE_SCHEDULE.dogFemaleLicence
        + dogsWithoutSex * COUNCIL_FEE_SCHEDULE.dogMaleLicence;
      return { province: row.province, annualRevenue };
    })
    .sort((a, b) => b.annualRevenue - a.annualRevenue)
    .slice(0, 8);

  function updateFinance<Key extends keyof RevenueAssumptions>(key: Key, value: number) {
    setFinanceOverrides((current) => ({ ...current, [key]: Math.max(0, value) }));
  }

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
            <RevenueButton onClick={() => setFinanceOpen(true)} className="mt-3 w-full" />
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
        <RevenueButton onClick={() => setFinanceOpen(true)} className="mb-3 w-full" />
        <LensBar lens={lens} onChange={setLens} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" />
        <NationalStats summary={summary} />
        {selected ? <ProvincePanel selected={selected} points={points} hint="Tap another circle to compare provinces." /> : null}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          <MapLegend />
        </div>
      </section>

      <Dialog open={financeOpen} onOpenChange={setFinanceOpen}>
        <DialogContent className="max-h-[94dvh] max-w-6xl gap-0 overflow-y-auto border-0 bg-[#f1f4ef] p-0 sm:rounded-xl">
          <div className="bg-[#123524] px-6 py-6 text-white sm:px-8">
            <DialogHeader>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">City revenue outlook · USD</p>
              <DialogTitle className="mt-2 text-2xl font-bold text-white sm:text-3xl">From one-time chips to recurring licences</DialogTitle>
              <DialogDescription className="mt-2 max-w-3xl text-sm leading-relaxed text-emerald-50/80">
                A 200,000-dog target scenario. Adjust the assumptions to shape the estimate; the province chart reflects live map records.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid grid-cols-1 divide-y divide-slate-200 border-b border-slate-200 bg-white px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
            <FinanceMetric label="One-time registration · Year 1" value={formatMoney(registrationRevenue)} detail={`${formatCount(registeredDogs)}-dog target`} />
            <FinanceMetric label="Recurring annual licences" value={formatMoney(recurringRevenue)} detail="Dog licences + breeding permits" />
            <FinanceMetric label="Three-year contribution" value={formatMoney(threeYearContribution)} detail="After modelled costs" emphasis />
          </div>

          <div className="grid gap-4 px-5 py-5 lg:grid-cols-2 lg:px-8">
            <div className="min-w-0 border-b border-slate-200 pb-5 lg:border-r lg:border-b-0 lg:pb-0 lg:pr-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">Revenue & city contribution</h3>
                  <p className="mt-1 text-xs text-slate-500">Registration occurs once; licences renew annually.</p>
                </div>
                <span className="shrink-0 rounded-sm bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">3-year view</span>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueTimeline} margin={{ top: 12, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid stroke="#e7ece7" vertical={false} />
                    <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#59665d", fontSize: 12 }} />
                    <YAxis tickFormatter={(value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(value)} tickLine={false} axisLine={false} tick={{ fill: "#59665d", fontSize: 11 }} width={44} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="registration" name="One-time registration" stackId="revenue" fill="#2f855a" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="dogLicences" name="Annual dog licences" stackId="revenue" fill="#4db6ac" />
                    <Bar dataKey="breedingLicences" name="Annual breeding licences" stackId="revenue" fill="#e0ae45" />
                    <Line dataKey="contribution" name="Contribution after costs" type="monotone" stroke="#143d2a" strokeWidth={3} dot={{ r: 4, fill: "#143d2a" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Year 1 contribution: {formatMoney(yearOneContribution)}. Years 2–3 show the recurring run-rate.</p>
            </div>

            <div className="min-w-0 pt-1 lg:pl-2">
              <div className="mb-2">
                <h3 className="font-bold text-slate-900">Annual dog licence potential by province</h3>
                <p className="mt-1 text-xs text-slate-500">Live dog counts × configured council rates at full renewal potential.</p>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={provinceRevenue} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke="#e7ece7" horizontal={false} />
                    <XAxis type="number" tickFormatter={(value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(value)} tickLine={false} axisLine={false} tick={{ fill: "#59665d", fontSize: 11 }} />
                    <YAxis dataKey="province" type="category" width={92} tickLine={false} axisLine={false} tick={{ fill: "#45544a", fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    <Bar dataKey="annualRevenue" name="Annual licence estimate" fill="#317a58" radius={[0, 4, 4, 0]} barSize={17} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Configured annual schedule: male {formatMoney(COUNCIL_FEE_SCHEDULE.dogMaleLicence)} · female {formatMoney(COUNCIL_FEE_SCHEDULE.dogFemaleLicence)}. Dogs with unrecorded sex use the male rate.</p>
            </div>
          </div>

          <div className="mx-5 mb-5 border-t border-slate-200 px-0 pt-5 sm:mx-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900">Scenario assumptions</h3>
                <p className="mt-1 text-xs text-slate-500">Green labels are proposed fees; council operating assumptions need validation.</p>
              </div>
              <p className="text-[11px] text-slate-500">Live register scale: {formatCount(summary.dogs)} dogs</p>
            </div>
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <FinanceInput label="Target dog population" value={finance.dogPopulationTarget} onChange={(value) => updateFinance("dogPopulationTarget", value)} />
              <FinanceInput label="Annual dog-licence renewal (%)" value={finance.annualLicenceRenewalPct} max={100} onChange={(value) => updateFinance("annualLicenceRenewalPct", value)} />
              <FinanceInput label="Female share of licensed dogs (%)" value={finance.femaleLicenceSharePct} max={100} onChange={(value) => updateFinance("femaleLicenceSharePct", value)} />
              <FinanceInput label="Community fee · proposed ($)" value={finance.communityRate} onChange={(value) => updateFinance("communityRate", value)} />
              <FinanceInput label="Standard fee · current anchor ($)" value={finance.standardRate} onChange={(value) => updateFinance("standardRate", value)} />
              <FinanceInput label="Suburb fee · proposed ($)" value={finance.suburbRate} onChange={(value) => updateFinance("suburbRate", value)} />
              <FinanceInput label="Breed-quality add-on · proposed ($)" value={finance.qualitySurcharge} onChange={(value) => updateFinance("qualitySurcharge", value)} />
              <FinanceInput label="Annual breeding licences" value={finance.breedingLicences} onChange={(value) => updateFinance("breedingLicences", value)} />
              <FinanceInput label="Breeding licence fee · proposed ($)" value={finance.breedingLicenceRate} onChange={(value) => updateFinance("breedingLicenceRate", value)} />
              <FinanceInput label="Microchip + registration cost / dog ($)" value={finance.chipCost} step="0.01" onChange={(value) => updateFinance("chipCost", value)} />
              <FinanceInput label="Annual programme operating cost ($)" value={finance.annualOperatingCost} step="100" onChange={(value) => updateFinance("annualOperatingCost", value)} />
            </div>
            <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">
              The model targets 200,000 dogs. Registration assumes a 40% community, 35% standard and 25% lower-density suburb mix; a 10% quality-breed subset pays the proposed surcharge. Annual licences assume the selected renewal rate and an even female/male mix unless changed. The $15 standard registration amount is the stated current starting point; other registration bands and breeding fees are proposals. Registration assumes each target dog needs a new microchip. Validate dog counts, tariffs and full delivery costs with the city. Forecast excludes penalties and assumes steady volumes and no inflation.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RevenueButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center justify-center gap-2 rounded-md bg-[#123524] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1b4c34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2", className)}>
      <TrendingUp className="size-4" aria-hidden="true" />
      Revenue outlook
    </button>
  );
}

function FinanceMetric({ label, value, detail, emphasis = false }: { label: string; value: string; detail: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-4 first:pl-0 last:pr-0 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", emphasis ? "text-emerald-800" : "text-slate-900")}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function FinanceInput({
  label,
  value,
  onChange,
  max,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  step?: string;
}) {
  return (
    <label className="block min-w-0 text-xs font-medium text-slate-600">
      {label}
      <input
        type="number"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Math.min(max ?? Number.MAX_SAFE_INTEGER, Number(event.currentTarget.value) || 0))}
        className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
      />
    </label>
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
