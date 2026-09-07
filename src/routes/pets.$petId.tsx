import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Camera, HeartPulse, ImagePlus, QrCode, ShieldCheck, ShieldPlus, Syringe } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { uploadPetPhoto } from "@/services/petService";

export const Route = createFileRoute("/pets/$petId")({
  head: () => ({
    meta: [
      { title: "Pet health passport — VetKonnect" },
      { name: "description", content: "A premium digital pet passport with health status, ID and full care timeline." },
      { property: "og:title", content: "Pet health passport — VetKonnect" },
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

function displayValue(value: string | number | null | undefined, fallback = "0.0") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function PetProfile() {
  const { petId } = Route.useParams();
  const { pets, ready, user, updatePet } = useApp();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pet = pets.find((p) => p.id === petId);

  if (!pet) {
    if (!ready)
      return (
        <AppShell>
          <div className="px-5 pt-16 text-sm text-muted-foreground">Loading…</div>
        </AppShell>
      );
    throw notFound();
  }

  const changePhoto = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    setPickerOpen(false);
    setUploading(true);
    try {
      const photoUrl = await uploadPetPhoto(file, pet.id);
      await updatePet(pet.id, { photoUrl });
      toast.success("Pet photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update photo.");
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  return (
    <AppShell>
      <div className="relative mb-[20px] overflow-hidden">
        {pet.photoUrl ? (
          <img src={pet.photoUrl} alt={pet.name} className="h-64 w-full object-cover" />
        ) : (
          <div className="flex h-64 items-center justify-center bg-accent text-primary">No photo</div>
        )}
        <Link
          to="/pets"
          className="absolute left-5 top-5 z-10 flex size-10 items-center justify-center rounded-full bg-background/90 backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void changePhoto(e.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void changePhoto(e.target.files?.[0] ?? null)}
        />

        <div className="absolute bottom-6 right-5 z-10 flex flex-col items-end gap-2">
          {pickerOpen ? (
            <div className="overflow-hidden rounded-2xl bg-background/95 shadow-[var(--shadow-card)] backdrop-blur">
              <button
                type="button"
                disabled={uploading}
                onClick={() => galleryRef.current?.click()}
                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-primary"
              >
                <ImagePlus className="size-4" />
                Gallery
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => cameraRef.current?.click()}
                className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-sm font-semibold text-primary"
              >
                <Camera className="size-4" />
                Camera
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={uploading}
            onClick={() => setPickerOpen((open) => !open)}
            className="flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-semibold text-primary shadow-[var(--shadow-card)] backdrop-blur"
          >
            <Camera className="size-4" />
            {uploading ? "Uploading…" : pet.photoUrl ? "Change photo" : "Add photo"}
          </button>
        </div>
      </div>

      <div className="-mt-8 rounded-t-3xl bg-background px-5 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">{displayValue(pet.name, "Pet")}</h1>
            <p className="text-sm text-muted-foreground">
              {displayValue(pet.breed)} · {displayValue(pet.sex)} · {displayValue(pet.ageYears)} years
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            <HeartPulse className="size-4" /> {displayValue(pet.healthStatus)}
          </span>
        </div>

        <div className="mt-5 card-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">VetKonnect Pet ID</p>
              <p className="mt-1 text-lg font-extrabold text-primary">{displayValue(pet.vetConnectId)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Tag / collar ID {displayValue(pet.collarId)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Microchip {displayValue(pet.microchip)}</p>
            </div>
            <div className="flex size-24 items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-accent/40">
              <QrCode className="size-14 text-primary" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Tile label="Weight" value={`${Number(pet.weightKg || 0).toFixed(1)} kg`} />
          <Tile label="Colour" value={displayValue(pet.colour)} />
          <Tile label="Next vaccine" value={displayValue(pet.nextVaccine)} />
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
              <Link to="/profile">Join</Link>
            </Button>
          )}
        </div>

        <h2 className="mt-7 text-lg font-bold">Health timeline</h2>
        <ol className="mt-3 space-y-4 border-l border-border pl-5">
          {(pet.timeline?.length ? pet.timeline : []).map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[27px] top-1 flex size-4 items-center justify-center rounded-full bg-primary">
                <Syringe className="size-2.5 text-primary-foreground" />
              </span>
              <p className="text-xs text-muted-foreground">{displayValue(e.date)}</p>
              <p className="font-semibold">{displayValue(e.title)}</p>
              <p className="text-sm text-muted-foreground">{displayValue(e.detail)}</p>
            </li>
          ))}
          {!pet.timeline?.length ? (
            <li className="text-sm text-muted-foreground">No timeline events yet · 0.0</li>
          ) : null}
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
