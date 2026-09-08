import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, HeartPulse, Pill, Syringe } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { isVetAccount } from "@/lib/account";
import { getPetRecordById } from "@/services/petService";
import { prescribeTreatment, rememberPatientId } from "@/services/vetService";
import type { HealthStatus, Pet } from "@/types";

export const Route = createFileRoute("/patients/$petId")({
  head: () => ({
    meta: [
      { title: "Patient health card — VetKonnect" },
      { name: "description", content: "Review patient history and prescribe treatment on VetKonnect." },
      { property: "og:title", content: "Patient health card — VetKonnect" },
      { property: "og:description", content: "Vet workspace for treatment and health card updates." },
    ],
  }),
  component: PatientDetail,
});

function displayValue(value: string | number | null | undefined, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function PatientDetail() {
  const { petId } = Route.useParams();
  const navigate = useNavigate();
  const { user, refreshSession } = useApp();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [medicationToday, setMedicationToday] = useState("");
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("Under Care");
  const [nextVaccine, setNextVaccine] = useState("");
  const [weightKg, setWeightKg] = useState("");

  useEffect(() => {
    if (!isVetAccount(user) || !user.vetVerified) {
      void navigate({ to: "/patients" });
      return;
    }

    setLoading(true);
    void getPetRecordById(petId)
      .then((record) => {
        if (!record) {
          toast.error("Patient not found.");
          void navigate({ to: "/patients" });
          return;
        }
        rememberPatientId(record.id);
        setPet(record);
        setMedicationToday(record.medicationToday === "None Today" ? "" : record.medicationToday);
        setHealthStatus(record.healthStatus === "Healthy" ? "Under Care" : record.healthStatus);
        setNextVaccine(record.nextVaccine === "Not scheduled" ? "" : record.nextVaccine);
        setWeightKg(record.weightKg ? String(record.weightKg) : "");
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Could not load patient.");
        void navigate({ to: "/patients" });
      })
      .finally(() => setLoading(false));
  }, [navigate, petId, user]);

  const submitTreatment = async () => {
    if (!pet) return;
    setSaving(true);
    try {
      const updated = await prescribeTreatment({
        petId: pet.id,
        title,
        detail,
        medicationToday: medicationToday.trim() || "None Today",
        healthStatus,
        nextVaccine: nextVaccine.trim() || pet.nextVaccine,
        weightKg: weightKg.trim() ? Number(weightKg) : undefined,
      });
      setPet(updated);
      setTitle("");
      setDetail("");
      await refreshSession();
      toast.success("Treatment saved", {
        description: `${updated.name}'s health card was updated.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save treatment.");
    } finally {
      setSaving(false);
    }
  };

  if (!isVetAccount(user)) {
    return (
      <AppShell>
        <div className="px-5 pt-16 text-center">
          <p className="font-bold">Vet accounts only</p>
          <Button asChild variant="hero" className="mt-4">
            <Link to="/home">Go to owner home</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (loading || !pet) {
    return (
      <AppShell>
        <div className="px-5 pt-16 text-sm text-muted-foreground">Loading patient…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="relative mb-5 overflow-hidden">
        {pet.photoUrl ? (
          <img src={pet.photoUrl} alt={pet.name} className="h-56 w-full object-cover" />
        ) : (
          <div className="flex h-56 items-center justify-center bg-accent text-primary">No photo</div>
        )}
        <Link
          to="/patients"
          className="absolute left-5 top-5 z-10 flex size-10 items-center justify-center rounded-full bg-background/90 backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <div className="-mt-8 rounded-t-3xl bg-background px-5 pt-6 pb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold">{displayValue(pet.name, "Patient")}</h1>
            <p className="text-sm text-muted-foreground">
              {displayValue(pet.breed)} · {displayValue(pet.sex)} · {displayValue(pet.ageYears)} years
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {displayValue(pet.vetConnectId)}
              {pet.collarId ? ` · Tag ${pet.collarId}` : ""}
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            <HeartPulse className="size-4" /> {displayValue(pet.healthStatus)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Tile label="Weight" value={`${Number(pet.weightKg || 0).toFixed(1)} kg`} />
          <Tile label="Meds today" value={displayValue(pet.medicationToday)} />
          <Tile label="Next vaccine" value={displayValue(pet.nextVaccine)} />
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Pill className="size-5 text-primary" />
            <h2 className="font-extrabold">Prescribe treatment</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Adds a treatment event and updates this animal’s health card.
          </p>

          <label className="mt-4 block text-sm font-medium">
            Treatment title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Antibiotics course"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none"
            />
          </label>

          <label className="mt-3 block text-sm font-medium">
            Details / dosage
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Dose, duration, notes for the owner…"
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none"
            />
          </label>

          <label className="mt-3 block text-sm font-medium">
            Medication today
            <input
              value={medicationToday}
              onChange={(e) => setMedicationToday(e.target.value)}
              placeholder="Shown on the owner health card"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none"
            />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Health status
              <select
                value={healthStatus}
                onChange={(e) => setHealthStatus(e.target.value as HealthStatus)}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none"
              >
                <option value="Healthy">Healthy</option>
                <option value="Attention">Attention</option>
                <option value="Under Care">Under Care</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Weight (kg)
              <input
                type="number"
                step="0.1"
                min="0"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none"
              />
            </label>
          </div>

          <label className="mt-3 block text-sm font-medium">
            Next vaccine
            <input
              value={nextVaccine}
              onChange={(e) => setNextVaccine(e.target.value)}
              placeholder="e.g. 12 Oct 2026"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-base outline-none"
            />
          </label>

          <Button
            variant="hero"
            className="mt-4 w-full"
            disabled={saving || title.trim().length < 2 || detail.trim().length < 2}
            onClick={() => void submitTreatment()}
          >
            {saving ? "Saving…" : "Save treatment & update card"}
          </Button>
        </section>

        <h2 className="mt-7 text-lg font-bold">Patient history</h2>
        <ol className="mt-3 space-y-4 border-l border-border pl-5">
          {(pet.timeline?.length ? pet.timeline : []).map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[27px] top-1 flex size-4 items-center justify-center rounded-full bg-primary">
                <Syringe className="size-2.5 text-primary-foreground" />
              </span>
              <p className="text-xs text-muted-foreground">{displayValue(event.date)}</p>
              <p className="font-semibold">{displayValue(event.title)}</p>
              <p className="text-sm text-muted-foreground">{displayValue(event.detail)}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-primary">{event.type}</p>
            </li>
          ))}
          {!pet.timeline?.length ? (
            <li className="text-sm text-muted-foreground">No history events yet.</li>
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
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
