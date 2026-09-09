import { useEffect, useState } from "react";
import { MapPin, Search, Star } from "lucide-react";
import { ClosestVetsMap } from "@/components/discover/ClosestVetsMap";
import { Button } from "@/components/ui/button";
import { getNearbyVets, getServices } from "@/services/contentService";
import type { MappableVet, ServiceListing } from "@/types";
import { getCurrentPosition, HARARE, type GeoPoint } from "@/lib/geo";
import { cn } from "@/lib/utils";

const categories = ["All", "Veterinary Clinic", "Grooming", "Pet Store", "Emergency"] as const;

export function CouncilDiscoverPanel() {
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [query, setQuery] = useState("");
  const [servicesData, setServicesData] = useState<ServiceListing[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [nearbyVets, setNearbyVets] = useState<MappableVet[]>([]);
  const [selectedVet, setSelectedVet] = useState<MappableVet | null>(null);
  const [locationNote, setLocationNote] = useState("");

  useEffect(() => {
    void getServices().then(setServicesData).catch((error) => console.error(error));
  }, []);

  const services = servicesData.filter(
    (s) =>
      (category === "All" || s.category === category) &&
      s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const openMap = async () => {
    setMapOpen(true);
    setMapLoading(true);
    setSelectedVet(null);
    try {
      let origin = HARARE;
      try {
        origin = await getCurrentPosition();
        setLocationNote("Closest clinics near you");
      } catch {
        origin = HARARE;
        setLocationNote("Location off — closest clinics around Harare");
      }
      setUserLocation(origin);
      const vets = await getNearbyVets(origin);
      setNearbyVets(vets);
    } catch (error) {
      console.error(error);
      setNearbyVets([]);
    } finally {
      setMapLoading(false);
    }
  };

  if (mapOpen) {
    return (
      <div className="relative flex min-h-[70dvh] flex-col">
        <div className="flex items-center justify-between px-5 pb-3 pt-2">
          <div>
            <h2 className="text-lg font-extrabold">Map clinics</h2>
            <p className="text-xs text-muted-foreground">{locationNote || (mapLoading ? "Loading…" : "")}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setMapOpen(false)}>
            Close map
          </Button>
        </div>
        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-t-2xl">
          {userLocation ? (
            <ClosestVetsMap
              userLocation={userLocation}
              vets={nearbyVets}
              selectedId={selectedVet?.id}
              onSelect={setSelectedVet}
              className="absolute inset-0 h-full w-full"
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 pb-8">
      <div>
        <h2 className="text-xl font-extrabold">Discover</h2>
        <p className="mt-1 text-sm text-muted-foreground">Veterinary and pet services across the city.</p>
      </div>

      <Button className="w-full bg-teal-800 hover:bg-teal-900" onClick={() => void openMap()}>
        Open clinics map
      </Button>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search services"
          className="h-11 w-full rounded-2xl border border-border bg-card pl-10 pr-4 text-base outline-none"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
              category === item ? "bg-teal-800 text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <div key={service.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{service.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{service.category}</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {service.rating.toFixed(1)}
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>{service.address}</span>
            </div>
            {service.open ? (
              <p className="mt-2 text-xs font-medium text-teal-800">Open</p>
            ) : (
              <p className="mt-2 text-xs font-medium text-muted-foreground">Closed</p>
            )}
          </div>
        ))}
        {services.length === 0 ? <p className="text-sm text-muted-foreground">No services match.</p> : null}
      </div>
    </div>
  );
}
