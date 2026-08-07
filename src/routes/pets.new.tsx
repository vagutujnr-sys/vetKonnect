import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Bird, Camera, Cat, Check, Dog, PawPrint, QrCode } from "lucide-react";
import { useState } from "react";
import buddy from "@/assets/pet-buddy.jpg";
import { MobileScreen } from "@/components/layout/MobileScreen";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { cn } from "@/lib/utils";
import type { Pet, Species } from "@/types";

export const Route = createFileRoute("/pets/new")({
  head: () => ({
    meta: [
      { title: "Add a pet — VetKonnect" },
      { name: "description", content: "Create a digital health profile and VetKonnect Pet ID for your companion." },
      { property: "og:title", content: "Add a pet — VetKonnect" },
      { property: "og:description", content: "Four quick steps to a full digital pet passport." },
    ],
  }),
  component: AddPet,
});

const speciesOptions: { value: Species; icon: typeof Dog }[] = [
  { value: "Dog", icon: Dog },
  { value: "Cat", icon: Cat },
  { value: "Bird", icon: Bird },
  { value: "Other", icon: PawPrint },
];

function AddPet() {
  const navigate = useNavigate();
  const { addPet } = useApp();
  const [step, setStep] = useState(1);
  const [created, setCreated] = useState<Pet | null>(null);
  const [form, setForm] = useState({
    name: "",
    species: "Dog" as Species,
    breed: "",
    sex: "Male" as "Male" | "Female",
    ageYears: "1",
    colour: "",
    microchip: "",
    collarId: "",
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    const pet = await addPet({
      name: form.name.trim(),
      species: form.species,
      breed: form.breed.trim() || form.species,
      sex: form.sex,
      ageYears: Number(form.ageYears) || 0,
      colour: form.colour.trim() || "Not specified",
      microchip: form.microchip.trim() || undefined,
      collarId: form.collarId.trim() || undefined,
      photoUrl: buddy,
    });
    setCreated(pet);
    setStep(4);
  };

  const canContinue =
    (step === 1 && form.name.trim().length > 1) || step === 2 || (step === 3 && form.breed.trim().length > 0);

  return (
    <MobileScreen className="px-5">
      <div className="flex items-center gap-3 pt-8">
        <button
          onClick={() => (step === 1 || created ? navigate({ to: "/pets" }) : setStep((s) => s - 1))}
          className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-border"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <p className="font-bold">Add a pet</p>
      </div>

      <div className="mt-6">
        <StepIndicator step={step} total={4} />
      </div>

      {step === 1 && (
        <div className="mt-8">
          <h1 className="text-2xl font-extrabold">
            Let's add your <span className="text-primary">pet</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a digital health profile for your companion.</p>
          <button className="mx-auto mt-8 flex size-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-full border-2 border-dashed border-primary/40 bg-accent/40 text-primary">
            <Camera className="size-7" />
            <span className="text-xs font-semibold">Add photo</span>
          </button>
          <Field label="Pet name" value={form.name} onChange={(v) => set({ name: v })} placeholder="e.g. Buddy" />
        </div>
      )}

      {step === 2 && (
        <div className="mt-8">
          <h1 className="text-2xl font-extrabold">What kind of animal?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Select the species for {form.name || "your pet"}.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {speciesOptions.map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => set({ species: value })}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-6 transition-all",
                  form.species === value ? "border-primary bg-accent/50" : "border-border bg-card",
                )}
              >
                <Icon className="size-7 text-primary" />
                <span className="font-semibold">{value}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-8">
          <h1 className="text-2xl font-extrabold">Pet details</h1>
          <p className="mt-1 text-sm text-muted-foreground">These details appear on the health passport.</p>
          <Field label="Breed" value={form.breed} onChange={(v) => set({ breed: v })} placeholder="e.g. Golden Retriever" />
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold">Sex</p>
            <div className="flex gap-3">
              {(["Male", "Female"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => set({ sex: s })}
                  className={cn(
                    "flex-1 cursor-pointer rounded-xl border py-3 font-medium",
                    form.sex === s ? "border-primary bg-accent/50 text-primary" : "border-border",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Field label="Age (years)" value={form.ageYears} onChange={(v) => set({ ageYears: v.replace(/\D/g, "") })} placeholder="3" />
          <Field label="Colour" value={form.colour} onChange={(v) => set({ colour: v })} placeholder="e.g. Golden" />
          <Field
            label="Microchip number (optional)"
            value={form.microchip}
            onChange={(v) => set({ microchip: v })}
            placeholder="985141002374561"
          />
          <Field
            label="Tag ID / Collar ID (optional)"
            value={form.collarId}
            onChange={(v) => set({ collarId: v })}
            placeholder="VC-20260806-001"
          />
        </div>
      )}

      {step === 4 && created && (
        <div className="mt-8 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-8" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold">{created.name} is registered</h1>
          <p className="mt-1 text-sm text-muted-foreground">The digital health passport is now active.</p>
          <div className="mt-6 card-surface p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">VetKonnect Pet ID</p>
            <p className="mt-1 text-xl font-extrabold text-primary">{created.vetConnectId}</p>
            <div className="mx-auto mt-5 flex size-36 items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-accent/40">
              <QrCode className="size-20 text-primary" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Scannable at partner clinics</p>
          </div>
        </div>
      )}

      <div className="mt-auto space-y-3 py-8">
        {step < 3 && (
          <Button variant="hero" size="lg" className="w-full justify-between" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
            Continue <ArrowRight className="size-5" />
          </Button>
        )}
        {step === 3 && (
          <Button variant="hero" size="lg" className="w-full justify-between" disabled={!canContinue} onClick={submit}>
            Create pet profile <ArrowRight className="size-5" />
          </Button>
        )}
        {step === 4 && created && (
          <>
            <Button asChild variant="hero" size="lg" className="w-full">
              <Link to="/pets/$petId" params={{ petId: created.id }}>
                View health passport
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link to="/pets">Back to my pets</Link>
            </Button>
          </>
        )}
      </div>
    </MobileScreen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="mt-5 block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-primary"
      />
    </label>
  );
}
