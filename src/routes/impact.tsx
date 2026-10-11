import { createFileRoute, Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ImpactOwnersMap } from "@/components/vet/ImpactOwnersMap";
import { VetFeatureGate } from "@/components/vet/VetFeatureGate";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { isVetAccount } from "@/lib/account";
import { getCurrentPosition, HARARE, type GeoPoint } from "@/lib/geo";
import { getPotentialClients } from "@/services/vetService";
import type { PotentialClient } from "@/types";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Impact — VetKonnect" },
      { name: "description", content: "Map nearby animals around your practice on VetKonnect." },
      { property: "og:title", content: "Impact — VetKonnect" },
      { property: "og:description", content: "See nearby animals on a full-screen map." },
    ],
  }),
  component: ImpactScreen,
});

function ImpactScreen() {
  const { user, refreshSession } = useApp();
  const [origin, setOrigin] = useState<GeoPoint>(HARARE);
  const [clients, setClients] = useState<PotentialClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PotentialClient | null>(null);
  const verified = Boolean(user.vetVerified);
  const nearbyAnimalCount = clients.reduce((total, location) => total + location.animals, 0);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    let cancelled = false;
    void getCurrentPosition()
      .then((point) => {
        if (!cancelled) setOrigin(point);
      })
      .catch(() => {
        /* keep Harare fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!verified) {
      setLoading(false);
      setClients([]);
      return;
    }
    setLoading(true);
    void getPotentialClients(origin, 40)
      .then((rows) => {
        // Closest first (service already sorts by distanceKm).
        setClients(rows);
        setSelected(null);
      })
      .catch((error) => {
        console.error("Failed to load closest owners", error);
        setClients([]);
      })
      .finally(() => setLoading(false));
  }, [verified, origin.latitude, origin.longitude]);

  if (!isVetAccount(user)) {
    return (
      <AppShell>
        <div className="px-5 pt-8">
          <h1 className="text-2xl font-extrabold">Impact</h1>
          <p className="mt-1 text-sm text-muted-foreground">This workspace is for vet accounts.</p>
          <Button asChild variant="hero" className="mt-6 w-full">
            <Link to="/home">Go to owner home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell immersive>
      <VetFeatureGate verified={verified} title="Impact">
        <div className="absolute inset-0 overflow-hidden bg-muted">
          <ImpactOwnersMap
            vetLocation={origin}
            owners={clients}
            selectedId={selected?.id}
            onSelect={setSelected}
            className="absolute inset-0 h-full w-full"
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-background/95 via-background/55 to-transparent px-4 pb-14 pt-6">
            <div className="pointer-events-auto flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">Impact</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Animal count at each location
                </p>
              </div>
              <span className="rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur">
                Impact ({loading ? "…" : nearbyAnimalCount})
              </span>
            </div>
          </div>

          {!loading && clients.length === 0 ? (
            <div className="absolute inset-x-4 top-1/3 z-10 rounded-2xl border border-border bg-card/95 p-5 text-center shadow-[var(--shadow-card)] backdrop-blur">
              <p className="mt-3 font-semibold">No nearby animals yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Registered pets and herd animals will appear on this map around your practice.
              </p>
            </div>
          ) : null}

          {selected ? (
            <div className="absolute inset-x-3 bottom-4 z-20 rounded-2xl border border-border bg-card/95 p-4 shadow-[var(--shadow-card)] backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-extrabold">
                        {selected.herdAnimals} Herded, {selected.pets} Pets
                      </h2>
                      <p className="mt-0.5 text-xs font-semibold text-primary">
                        {selected.distanceKm.toFixed(1)} km away
                        {selected.approximate ? " · approx." : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                      aria-label="Close"
                      onClick={() => setSelected(null)}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </VetFeatureGate>
    </AppShell>
  );
}
