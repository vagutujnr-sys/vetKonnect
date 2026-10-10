import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, HeartPulse, Pill, Syringe } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { DvsPetCertificates } from "@/components/dvs/DvsPetCertificates";
import { PetIdQrCode } from "@/components/pets/PetIdQrCode";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
  const [serviceProvided, setServiceProvided] = useState("Consultation");
  const [visitNotes, setVisitNotes] = useState("");
  const [medicationToday, setMedicationToday] = useState("");
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("Under Care");
  const [nextVaccine, setNextVaccine] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUpDate);
  const [followUpTime, setFollowUpTime] = useState("09:00");
  const [treatmentDrawerOpen, setTreatmentDrawerOpen] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

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
        setNextVaccine(toDateInputValue(record.nextVaccine));
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
      const result = await prescribeTreatment({
        petId: pet.id,
        title,
        detail,
        serviceProvided: serviceProvided.trim() || "Consultation",
        visitNotes: visitNotes.trim(),
        medicationToday: medicationToday.trim() || "None Today",
        healthStatus,
        nextVaccine: nextVaccine.trim() || pet.nextVaccine,
        weightKg: weightKg.trim() ? Number(weightKg) : undefined,
        followUpDate,
        followUpTime,
      });
      setPet(result.pet);
      setTitle("");
      setDetail("");
      setServiceProvided("Consultation");
      setVisitNotes("");
      setWhatsappUrl(result.whatsappUrl ?? null);
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      await refreshSession();
      toast.success("Treatment saved", {
        description:
          result.whatsapp === "sent"
            ? `Twilio sent the receipt and follow-up visit to ${result.pet.name}'s owner.`
            : result.whatsapp === "ready"
              ? `Twilio is not set up yet. WhatsApp is open so you can send the receipt and follow-up for ${result.pet.name}.`
              : result.whatsapp === "no_phone"
                ? `${result.pet.name}'s card was updated. The owner has no registered mobile number.`
                : result.whatsapp === "opted_out"
                  ? `${result.pet.name}'s card was updated. The owner has not turned on WhatsApp in Settings.`
                  : result.whatsappError || `${result.pet.name}'s card was updated. Twilio could not send the WhatsApp message.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save treatment.");
    } finally {
      setSaving(false);
    }
  };

  if (!isVetAccount(user)) {
    return (
      <AppShell scrollClassName="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      <AppShell scrollClassName="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="px-5 pt-16 text-sm text-muted-foreground">Loading patient…</div>
      </AppShell>
    );
  }

  return (
    <AppShell scrollClassName="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

      <div className="-mt-8 rounded-t-3xl bg-background pb-8 pt-6">
        <div className="flex items-start justify-between gap-3 px-5">
          <div>
            <h1 className="text-3xl font-extrabold">{displayValue(pet.name, "Patient")}</h1>
            <p className="text-sm text-muted-foreground">
              {displayValue(pet.breed)} · {displayValue(pet.sex)} · {displayValue(pet.ageYears)} years
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              Last attended by {displayValue(pet.lastAttendedBy || pet.timeline?.[0]?.attendedBy || "VetKonnect clinic")}
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            <HeartPulse className="size-4" /> {displayValue(pet.healthStatus)}
          </span>
        </div>

        <section className="mx-5 mt-4 flex items-center gap-3 rounded-md bg-card p-3 shadow-[var(--shadow-card)]">
          <PetIdQrCode
            vetConnectId={pet.vetConnectId}
            className="size-20 shrink-0 rounded-sm bg-white p-1"
          />
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">VetKonnect Pet ID</p>
            <p className="font-mono font-bold">{displayValue(pet.vetConnectId)}</p>
            {pet.collarId ? <p className="mt-1 text-xs text-muted-foreground">Tag {pet.collarId}</p> : null}
          </div>
        </section>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Tile label="Weight" value={`${Number(pet.weightKg || 0).toFixed(1)} kg`} />
          <Tile label="Meds today" value={displayValue(pet.medicationToday)} />
          <Tile label="Next vaccine" value={displayValue(pet.nextVaccine)} />
        </div>

        <section className="mt-2 rounded-md bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <Pill className="size-5 text-primary" />
            <h2 className="font-extrabold">Treatment</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Update the patient record and keep the owner informed after the visit.
          </p>

          <Drawer open={treatmentDrawerOpen} onOpenChange={setTreatmentDrawerOpen} shouldScaleBackground={false}>
            <DrawerTrigger asChild>
              <Button variant="hero" className="mt-4 w-full">
                Treatment Granted
              </Button>
            </DrawerTrigger>

            <DrawerContent className="max-h-[88vh] rounded-t-[20px] border-t border-border/70">
              <DrawerHeader className="pb-2 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DrawerTitle className="text-left text-xl font-extrabold">Record Treatment</DrawerTitle>
                    <DrawerDescription className="mt-1 text-left text-xs text-muted-foreground">
                      Capture the treatment details for this patient.
                    </DrawerDescription>
                  </div>

                  <Button type="button" variant="secondary" size="sm" className="h-8 px-3 text-[11px]" disabled>
                    Record Treatment
                  </Button>
                </div>
              </DrawerHeader>

              <div className="scrollbar-none overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="mt-0 space-y-3">
                  <label className="block text-[12px] font-medium text-muted-foreground">
                    Treatment title
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Antibiotics course"
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                    />
                  </label>

                  <label className="block text-[12px] font-medium text-muted-foreground">
                    Details / dosage
                    <textarea
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                      placeholder="Dose, duration, notes for the owner…"
                      rows={3}
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                    />
                  </label>

                  <label className="block text-[12px] font-medium text-muted-foreground">
                    Service given
                    <input
                      value={serviceProvided}
                      onChange={(e) => setServiceProvided(e.target.value)}
                      placeholder="e.g. Vaccination, wound care, exam"
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                    />
                  </label>

                  <label className="block text-[12px] font-medium text-muted-foreground">
                    Vet notes
                    <textarea
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                      placeholder="Add observations, recommendations, or treatment notes…"
                      rows={3}
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                    />
                  </label>

                  <label className="block text-[12px] font-medium text-muted-foreground">
                    Medication today
                    <input
                      value={medicationToday}
                      onChange={(e) => setMedicationToday(e.target.value)}
                      placeholder="Shown on the owner health card"
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                    />
                  </label>

                  <label className="block text-[12px] font-medium text-muted-foreground">
                    Weight (kg)
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                    />
                  </label>

                  <label className="block text-[12px] font-medium text-muted-foreground">
                    Next vaccine
                    <input
                      type="date"
                      value={nextVaccine}
                      onChange={(e) => setNextVaccine(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-[12px] font-medium text-muted-foreground">
                      Follow-up date
                      <input
                        type="date"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                      />
                    </label>
                    <label className="block text-[12px] font-medium text-muted-foreground">
                      Follow-up time
                      <input
                        type="time"
                        value={followUpTime}
                        onChange={(e) => setFollowUpTime(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                      />
                    </label>
                  </div>

                  <div className="rounded-lg border border-border bg-accent/30 px-3 py-2 text-[11px] text-muted-foreground">
                    <p className="font-semibold text-foreground">Latest recorded overview</p>
                    <p className="mt-1">
                      Service: {displayValue(pet.lastService || pet.timeline?.[0]?.service || "Consultation")}
                    </p>
                    <p>
                      Overall health: {displayValue(pet.lastOverallHealth || pet.timeline?.[0]?.overallHealth || pet.healthStatus)}
                    </p>
                  </div>

                  <label className="block text-[12px] font-medium text-muted-foreground">
                    Health status
                    <select
                      value={healthStatus}
                      onChange={(e) => setHealthStatus(e.target.value as HealthStatus)}
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none"
                    >
                      <option value="Healthy">Healthy</option>
                      <option value="Attention">Attention</option>
                      <option value="Under Care">Under Care</option>
                    </select>
                  </label>

                  <Button
                    type="button"
                    variant="hero"
                    className="mt-2 w-full"
                    disabled={saving}
                    onClick={() => void submitTreatment()}
                  >
                    {saving ? "Submitting…" : "Submit Treatment"}
                  </Button>

                  {whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-center text-sm font-semibold text-primary"
                    >
                      Send receipt and visit on WhatsApp
                    </a>
                  ) : null}
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        </section>

        <DvsPetCertificates petId={pet.id} />

        <h2 className="mt-7 px-5 text-lg font-bold">Patient history</h2>
        <ol className="mx-5 mt-3 space-y-4 border-l border-border pl-5">
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

function defaultFollowUpDate() {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${next.getFullYear()}-${month}-${day}`;
}

function toDateInputValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "Not scheduled") return "";
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-card p-3 text-center shadow-[var(--shadow-card)]">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
