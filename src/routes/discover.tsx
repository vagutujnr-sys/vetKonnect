import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Search, Siren, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { getServices } from "@/services/contentService";
import type { ServiceListing } from "@/types";
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

  useEffect(() => {
    void getServices().then(setServicesData).catch((error) => console.error("Failed to load services", error));
  }, []);

  const services = servicesData.filter(
    (s) =>
      (category === "All" || s.category === category) &&
      s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <AppShell>
      <ScreenHeader title="Discover" subtitle="Trusted care and services near Harare." />

      <div className="px-5">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-3">
          <Search className="size-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clinics, grooming, stores"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-4">
        {categories.map((c) => (
          <button
            key={c}
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
            <img src={s.imageUrl} alt={s.name} loading="lazy" className="h-36 w-full object-cover" />
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
              <p className="mt-1 text-xs text-muted-foreground">
                Map-ready coordinates: {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
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
