import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, HeartPulse, QrCode, ShieldCheck, ShieldPlus, Syringe } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";

export const Route = createFileRoute("/pets/$petId")({
  head: () => ({
    meta: [
      { title: "Pet health passport — VetConnect Pets" },
      { name: "description", content: "A premium digital pet passport with health status, ID and full care timeline." },
      { property: "og:title", content: "Pet health passport — VetConnect Pets" },
      { property: "og:description", content: "Health status, VetSure cover, QR ID and care history." },
    ],
  }),
  component: PetProfile,
  notFoundComponent: () => (
    <AppShell>
      <div className="px-5 pt-16 text-center">
        <p className="font-bold">Pet not found</p>
        <Button asChild variant="hero" className="mt-4">
          <Link to="/pets">Back to my pets</Link>
        </Button>
      </div>
    </AppShell>
  ),
});

function PetProfile() {
  const { petId } = Route.useParams();
  const { pets, ready, user } = useApp();
  const pet = pets.find((p) => p.id === petId);

  if (!pet) {
    if (!ready) return <AppShell><div className="px-5 pt-16 text-sm text-muted-foreground">Loading…</div></AppShell>;
    throw notFound();
  }

  return (
    <AppShell>
      <div className="relative mb-[20px] overflow-hidden">
        <img src={pet.photoUrl} alt={pet.name} className="h-64 w-full object-cover" />
        <Link
          to="/pets"
          className="absolute left-5 top-5 flex size-10 items-center justify-center rounded-full bg-background/90 backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <div className="-mt-8 rounded-t-3xl bg-background px-5 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">{pet.name}</h1>
            <p className="text-sm text-muted-foreground">
              {pet.breed} · {pet.sex} · {pet.ageYears} years
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            <HeartPulse className="size-4" /> {pet.healthStatus}
          </span>
        </div>

        <div className="mt-5 card-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">VetConnect Pet ID</p>
              <p className="mt-1 text-lg font-extrabold text-primary">{pet.vetConnectId}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {pet.microchip ? `Microchip ${pet.microchip}` : "No microchip recorded"}
              </p>
            </div>
            <div className="flex size-24 items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-accent/40">
              <QrCode className="size-14 text-primary" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Tile label="Weight" value={pet.weightKg ? `${pet.weightKg} kg` : "—"} />
          <Tile label="Colour" value={pet.colour} />
          <Tile label="Next vaccine" value={pet.nextVaccine} />
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent bg-accent/40 p-4">
          {user.vetSureMember || pet.vetSure ? (
            <ShieldCheck className="size-6 text-primary" />
          ) : (
            <ShieldPlus className="size-6 text-primary" />
          )}
          <div className="flex-1">
            <p className="font-semibold">VetSure</p>
            <p className="text-sm text-muted-foreground">
              {user.vetSureMember || pet.vetSure ? "Active cover · full benefits" : "Not covered yet"}
            </p>
          </div>
          {!(user.vetSureMember || pet.vetSure) && (
            <Button asChild variant="hero" size="sm">
              <Link to="/home">Join</Link>
            </Button>
          )}
        </div>

        <h2 className="mt-7 text-lg font-bold">Health timeline</h2>
        <ol className="mt-3 space-y-4 border-l border-border pl-5">
          {pet.timeline.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[27px] top-1 flex size-4 items-center justify-center rounded-full bg-primary">
                <Syringe className="size-2.5 text-primary-foreground" />
              </span>
              <p className="text-xs text-muted-foreground">{e.date}</p>
              <p className="font-semibold">{e.title}</p>
              <p className="text-sm text-muted-foreground">{e.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </AppShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
