import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, HeartPulse, PawPrint, Plus, ShieldCheck } from "lucide-react";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pets/")({
  head: () => ({
    meta: [
      { title: "My Pets — VetKonnect" },
      { name: "description", content: "All your pets and their digital health passports in one place." },
      { property: "og:title", content: "My Pets — VetKonnect" },
      { property: "og:description", content: "Manage every companion's health profile." },
    ],
  }),
  component: PetsScreen,
});

function PetsScreen() {
  const { pets, activePetId, setActivePet } = useApp();

  return (
    <AppShell>
      <ScreenHeader
        title="My Pets"
        subtitle={`${pets.length} ${pets.length === 1 ? "companion" : "companions"} under your care`}
        action={
          <Button asChild size="icon" variant="hero">
            <Link to="/pets/new" aria-label="Add pet">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 px-5">
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
    </AppShell>
  );
}
