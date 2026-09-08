import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Phone, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { VetFeatureGate } from "@/components/vet/VetFeatureGate";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { isVetAccount } from "@/lib/account";
import { getPotentialClients } from "@/services/vetService";
import type { PotentialClient } from "@/types";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Impact — VetKonnect" },
      { name: "description", content: "See potential clients near your practice on VetKonnect." },
      { property: "og:title", content: "Impact — VetKonnect" },
      { property: "og:description", content: "Reach nearby pet owners who need veterinary care." },
    ],
  }),
  component: ImpactScreen,
});

function ImpactScreen() {
  const { user, refreshSession } = useApp();
  const [clients, setClients] = useState<PotentialClient[]>([]);
  const [loading, setLoading] = useState(true);
  const verified = Boolean(user.vetVerified);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!verified) {
      setLoading(false);
      return;
    }
    void getPotentialClients()
      .then(setClients)
      .catch((error) => console.error("Failed to load potential clients", error))
      .finally(() => setLoading(false));
  }, [verified]);

  if (!isVetAccount(user)) {
    return (
      <AppShell>
        <ScreenHeader title="Impact" subtitle="This workspace is for vet accounts." />
        <div className="px-5">
          <Button asChild variant="hero" className="w-full">
            <Link to="/home">Go to owner home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScreenHeader
        title="Impact"
        subtitle="Potential clients near your practice — pet owners who may need care."
      />

      <VetFeatureGate verified={verified} title="Impact">
        <section className="mx-5 mb-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent">
              <Users className="size-5 text-primary" />
            </span>
            <div>
              <p className="text-3xl font-extrabold">{loading ? "…" : clients.length}</p>
              <p className="text-sm text-muted-foreground">Nearby potential clients</p>
            </div>
          </div>
        </section>

        <section className="mx-5 mb-6 space-y-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Finding nearby owners…</p>
          ) : clients.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center">
              <MapPin className="mx-auto size-8 text-primary" />
              <p className="mt-3 font-semibold">No potential clients yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When pet owners nearby join VetKonnect, they will show up here.
              </p>
            </div>
          ) : (
            clients.map((client) => (
              <article key={client.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold">{client.fullName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {client.pets} pet{client.pets === 1 ? "" : "s"}
                      {client.petNames.length ? ` · ${client.petNames.slice(0, 3).join(", ")}` : ""}
                    </p>
                    {client.memberSince ? (
                      <p className="mt-1 text-xs text-muted-foreground">Member since {client.memberSince}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">Owner</span>
                </div>
                {client.phone ? (
                  <a
                    href={`tel:${client.phone}`}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary"
                  >
                    <Phone className="size-4" />
                    {client.phone}
                  </a>
                ) : null}
              </article>
            ))
          )}
        </section>
      </VetFeatureGate>
    </AppShell>
  );
}
