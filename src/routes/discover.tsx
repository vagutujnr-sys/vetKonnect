import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MapPinned, MapPin, MessageSquare, Phone, Search, Siren, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClosestVetsMap } from "@/components/discover/ClosestVetsMap";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { isVetAccount } from "@/lib/account";
import { getOrCreateConversationWithVet, resolveVetAccountId } from "@/services/chatService";
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
  const navigate = useNavigate();
  const { user } = useApp();
  const isVet = isVetAccount(user);
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [query, setQuery] = useState("");
  const [servicesData, setServicesData] = useState<ServiceListing[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [nearbyVets, setNearbyVets] = useState<MappableVet[]>([]);
  const [selectedVet, setSelectedVet] = useState<MappableVet | null>(null);
  const [locationNote, setLocationNote] = useState("");
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const startChatWithVet = async (vet: MappableVet) => {
    setMessagingId(vet.id);
    try {
      const resolved = await resolveVetAccountId({ surgeryId: vet.id, phone: vet.phone });
      if (!resolved) {
        toast.message("Chat unavailable for this clinic yet", {
          description: "This surgery is not linked to a VetKonnect vet account. You can still call if a number is listed.",
        });
        return;
      }
      const conversation = await getOrCreateConversationWithVet({
        vetAccountId: resolved.accountId,
        surgeryId: vet.id,
      });
      void navigate({ to: "/chats/$conversationId", params: { conversationId: conversation.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start chat");
    } finally {
      setMessagingId(null);
    }
  };

  useEffect(() => {
    void getServices().then(setServicesData).catch((error) => console.error("Failed to load services", error));
  }, []);

  useEffect(() => {
    // Vets use Impact for maps — never keep Map Vets open for vet accounts.
    if (isVet && mapOpen) {
      setMapOpen(false);
      setNearbyVets([]);
      setSelectedVet(null);
    }
  }, [isVet, mapOpen]);

  const services = servicesData.filter(
    (s) =>
      (category === "All" || s.category === category) &&
      s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const openMapVets = async () => {
    if (isVet) {
      toast.message("Map Vets is for pet owners", {
        description: "Use Impact to see nearby owners around your practice.",
      });
      return;
    }

    setMapOpen(true);
    setMapLoading(true);
    setSelectedVet(null);
    setLocationNote("");
    try {
      let origin = HARARE;
      try {
        origin = await getCurrentPosition();
        setLocationNote("Closest clinics near you");
      } catch {
        origin = HARARE;
        setLocationNote("Location off — closest clinics around Harare");
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

  if (mapOpen && !isVet) {
    return (
      <AppShell immersive>
        <div className="absolute inset-0 overflow-hidden bg-muted">
          {mapLoading || !userLocation ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Locating nearby vets…
            </div>
          ) : (
            <ClosestVetsMap
              userLocation={userLocation}
              vets={nearbyVets}
              selectedId={selectedVet?.id}
              onSelect={setSelectedVet}
              className="absolute inset-0 h-full w-full"
            />
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background/95 via-background/55 to-transparent px-4 pb-14 pt-6">
            <div className="pointer-events-auto flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">Map Vets</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {locationNote || "Finding nearby clinics…"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur">
                  {mapLoading ? "…" : `${nearbyVets.length} closest`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMapOpen(false);
                    setSelectedVet(null);
                  }}
                  className="flex size-9 items-center justify-center rounded-full border border-border bg-card/95 shadow-sm backdrop-blur"
                  aria-label="Close map"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {selectedVet ? (
            <div className="absolute inset-x-3 bottom-28 z-20 rounded-2xl border border-border bg-card/95 p-4 shadow-[var(--shadow-card)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold">{selectedVet.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{selectedVet.surgery}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {selectedVet.address || "Address unavailable"} · {selectedVet.distanceKm.toFixed(1)} km
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      <Star className="size-3.5 fill-current" /> {selectedVet.rating.toFixed(1)}
                    </span>
                    {selectedVet.phone ? (
                      <span className="font-medium text-muted-foreground">{selectedVet.phone}</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {selectedVet.phone ? (
                      <a
                        href={`tel:${selectedVet.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        <Phone className="size-3.5" /> Call
                      </a>
                    ) : null}
                    <button
                      type="button"
                      disabled={messagingId === selectedVet.id}
                      onClick={() => void startChatWithVet(selectedVet)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                    >
                      <MessageSquare className="size-3.5 text-primary" />
                      {messagingId === selectedVet.id ? "Opening…" : "Message"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                  aria-label="Close"
                  onClick={() => setSelectedVet(null)}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ) : !mapLoading && nearbyVets.length > 0 ? (
            <div className="absolute inset-x-3 bottom-28 z-20 max-h-48 overflow-y-auto rounded-2xl border border-border bg-card/95 shadow-[var(--shadow-card)] backdrop-blur">
              {nearbyVets.map((vet, index) => (
                <div
                  key={vet.id}
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedVet(vet)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{vet.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {vet.distanceKm.toFixed(1)} km · {vet.surgery}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {vet.phone ? (
                      <a
                        href={`tel:${vet.phone}`}
                        className="flex size-9 items-center justify-center rounded-full bg-accent text-primary"
                        aria-label={`Call ${vet.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="size-4" />
                      </a>
                    ) : (
                      <span
                        className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground/50"
                        title="No phone on file"
                      >
                        <Phone className="size-4" />
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={messagingId === vet.id}
                      className="flex size-9 items-center justify-center rounded-full bg-accent text-primary disabled:opacity-60"
                      aria-label={`Message ${vet.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void startChatWithVet(vet);
                      }}
                    >
                      <MessageSquare className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </AppShell>
    );
  }

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

        {!isVet ? (
          <Button
            type="button"
            variant="hero"
            size="lg"
            className="mt-4 w-full justify-between"
            onClick={() => void openMapVets()}
          >
            <span className="inline-flex items-center gap-2">
              <MapPinned className="size-5" />
              Map Vets
            </span>
            <span className="text-sm font-medium opacity-90">Closest 5</span>
          </Button>
        ) : null}
      </div>

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
