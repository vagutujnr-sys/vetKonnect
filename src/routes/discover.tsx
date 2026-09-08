import { createFileRoute } from "@tanstack/react-router";
import { MapPinned, MapPin, Phone, Search, Siren, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClosestVetsMap } from "@/components/discover/ClosestVetsMap";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { getNearbyVets, getServices } from "@/services/contentService";
import type { MappableVet, ServiceListing } from "@/types";
import { getCurrentPosition, HARARE, type GeoPoint } from "@/lib/geo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover services — VetKonnect" },
      { name: "description", content: "Find veterinary clinics, grooming, pet stores and emergency care nearby." },
      { property: "og:title", content: "Discover services — VetKonnect" },
      { property: "og:description", content: "Trusted veterinary and pet services around you." },
    ],
  }),
  component: Discover,
});

const categories = ["All", "Veterinary Clinic", "Grooming", "Pet Store", "Emergency"] as const;

function Discover() {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [query, setQuery] = useState("");
  const [servicesData, setServicesData] = useState<ServiceListing[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [nearbyVets, setNearbyVets] = useState<MappableVet[]>([]);
  const [locationNote, setLocationNote] = useState("");

  useEffect(() => {
    void getServices().then(setServicesData).catch((error) => console.error("Failed to load services", error));
  }, []);

  const services = servicesData.filter(
    (s) =>
      (category === "All" || s.category === category) &&
      s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const openMapVets = async () => {
    setMapOpen(true);
    setMapLoading(true);
    setLocationNote("");
    try {
      let origin = HARARE;
      try {
        origin = await getCurrentPosition();
        setLocationNote("Showing vets near your current location");
      } catch {
        origin = HARARE;
        setLocationNote("Location permission unavailable — showing nearest vets around Harare");
        toast.message("Using Harare as your location", {
          description: "Allow location access for more accurate results.",
        });
      }

      const vets = await getNearbyVets(origin, 5);
      setUserLocation(origin);
      setNearbyVets(vets);
      if (vets.length === 0) {
        toast.error("No nearby vets found yet.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the vet map.");
      setMapOpen(false);
    } finally {
      setMapLoading(false);
    }
  };

  return (
    <AppShell>
      <ScreenHeader title="Discover" subtitle="Trusted care and services near you." />

      <div className="px-5">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-3">
          <Search className="size-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clinics, grooming, stores"
            className="w-full bg-transparent text-base outline-none"
          />
        </div>

        <Button type="button" variant="hero" size="lg" className="mt-4 w-full justify-between" onClick={() => void openMapVets()}>
          <span className="inline-flex items-center gap-2">
            <MapPinned className="size-5" />
            Map Vets
          </span>
          <span className="text-sm font-medium opacity-90">Closest 5</span>
        </Button>
      </div>

      {mapOpen ? (
        <section className="mx-5 mt-4 overflow-hidden rounded-3xl border border-border bg-white shadow-[var(--shadow-card)]">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="font-bold">Closest vets</p>
              <p className="text-xs text-muted-foreground">{locationNote || "Finding nearby clinics…"}</p>
            </div>
            <button
              type="button"
              onClick={() => setMapOpen(false)}
              className="flex size-9 items-center justify-center rounded-full border border-border"
              aria-label="Close map"
            >
              <X className="size-4" />
            </button>
          </div>

          {mapLoading || !userLocation ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Locating nearby vets…</div>
          ) : (
            <ClosestVetsMap userLocation={userLocation} vets={nearbyVets} className="h-72 w-full" />
          )}

          <div className="divide-y divide-border">
            {nearbyVets.map((vet, index) => (
              <article key={vet.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{vet.name}</p>
                  <p className="text-sm text-muted-foreground">{vet.surgery}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {vet.address || "Address unavailable"} · {vet.distanceKm.toFixed(1)} km
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      <Star className="size-3.5 fill-current" /> {vet.rating.toFixed(1)}
                    </span>
                    {vet.phone ? (
                      <a href={`tel:${vet.phone}`} className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <Phone className="size-3.5 text-primary" />
                        {vet.phone}
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {!mapLoading && nearbyVets.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No nearby vets available yet.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-4">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium",
              category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-5">
        {services.map((s) => (
          <article key={s.id} className="card-surface overflow-hidden">
            {s.imageUrl ? <img src={s.imageUrl} alt={s.name} loading="lazy" className="h-36 w-full object-cover" /> : null}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{s.name}</p>
                  <p className="text-sm text-muted-foreground">{s.category}</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                  <Star className="size-3.5 fill-current" /> {s.rating}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {s.address} · {s.distanceKm} km
              </p>
              <p className={cn("mt-2 text-xs font-semibold", s.open ? "text-primary" : "text-muted-foreground")}>
                {s.open ? "Open now" : "Closed"}
              </p>
            </div>
          </article>
        ))}
        {services.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No services match your search.</p>
        )}
      </div>

      <div className="mx-5 my-6 flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground">
        <Siren className="size-6" />
        <div className="flex-1">
          <p className="font-bold">Emergency assistance</p>
          <p className="text-sm opacity-85">24/7 veterinary response line</p>
        </div>
      </div>
    </AppShell>
  );
}
