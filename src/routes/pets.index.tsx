import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, HeartPulse, PawPrint, Plus, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { FarmPanel } from "@/components/pets/FarmPanel";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pets/")({
  head: () => ({
    meta: [
      { title: "My Animals — VetKonnect" },
      { name: "description", content: "Companion pets and farm herds in one place." },
      { property: "og:title", content: "My Animals — VetKonnect" },
      { property: "og:description", content: "Manage pets, herds, and animals kept in groups." },
    ],
  }),
  component: PetsScreen,
});

function PetsScreen() {
  const { pets, activePetId, setActivePet } = useApp();
  const [tab, setTab] = useState<"pets" | "farm">("pets");
  const [creatingHerd, setCreatingHerd] = useState(false);

  return (
    <AppShell>
      <ScreenHeader
        title="My Animals"
        subtitle={
          tab === "pets"
            ? `${pets.length} ${pets.length === 1 ? "companion" : "companions"} under your care`
            : "Herds and animals kept in groups"
        }
        action={
          tab === "pets" ? (
            <Button asChild size="icon" variant="hero">
              <Link to="/pets/new" aria-label="Add pet">
                <Plus className="size-5" />
              </Link>
            </Button>
          ) : (
            <Button
              size="icon"
              variant="hero"
              aria-label={creatingHerd ? "Close new herd form" : "New herd"}
              onClick={() => setCreatingHerd((open) => !open)}
            >
              {creatingHerd ? <X className="size-5" /> : <Plus className="size-5" />}
            </Button>
          )
        }
      >
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-muted/80 p-1">
          {(
            [
              { id: "pets", label: "Pets" },
              { id: "farm", label: "Farm" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                if (item.id !== "farm") setCreatingHerd(false);
              }}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold",
                tab === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </ScreenHeader>

      {tab === "pets" ? (
        <div className="space-y-4 px-5 pb-8">
          {pets.map((pet) => (
            <div
              key={pet.id}
              className={cn(
                "card-surface overflow-hidden",
                pet.id === activePetId && "ring-2 ring-primary/60",
              )}
            >
              <button onClick={() => setActivePet(pet.id)} className="flex w-full cursor-pointer gap-4 p-4 text-left">
                {pet.photoUrl ? (
                  <img src={pet.photoUrl} alt={pet.name} loading="lazy" className="size-20 rounded-2xl object-cover" />
                ) : (
                  <span className="flex size-20 items-center justify-center rounded-2xl bg-accent text-primary">
                    <PawPrint className="size-8" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-bold">{pet.name}</h2>
                    {pet.vetSure && <ShieldCheck className="size-4 text-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pet.breed} · {pet.sex}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pet.ageYears} {pet.ageYears === 1 ? "year" : "years"} · {pet.colour}
                  </p>
                  <span
                    className={cn(
                      "mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                      pet.healthStatus === "Healthy"
                        ? "bg-accent text-accent-foreground"
                        : "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.12_70)]",
                    )}
                  >
                    <HeartPulse className="size-3.5" />
                    {pet.healthStatus}
                  </span>
                </div>
              </button>
              <Link
                to="/pets/$petId"
                params={{ petId: pet.id }}
                className="flex items-center justify-between border-t border-border px-4 py-3 text-sm font-semibold text-primary"
              >
                Open health passport <ChevronRight className="size-4" />
              </Link>
            </div>
          ))}

          <Link
            to="/pets/new"
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 py-6 text-sm font-semibold text-primary"
          >
            <PawPrint className="size-5" /> Add a new pet
          </Link>
        </div>
      ) : (
        <FarmPanel createOpen={creatingHerd} onCreateOpenChange={setCreatingHerd} />
      )}
    </AppShell>
  );
}
