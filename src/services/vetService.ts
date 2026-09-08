import type { HealthStatus, Pet, PotentialClient } from "@/types";
import { createNotification } from "./notificationService";
import { findPetByTag, getPetRecordById, updatePet } from "./petService";
import { supabase } from "./supabaseClient";
import { getUser, updateUser } from "./userService";

const RECENT_PATIENTS_KEY = "vetkonnect:recent_patients";

export type PrescribeTreatmentInput = {
  petId: string;
  title: string;
  detail: string;
  medicationToday?: string;
  healthStatus?: HealthStatus;
  nextVaccine?: string;
  weightKg?: number;
};

export function getRecentPatientIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(RECENT_PATIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function rememberPatientId(petId: string): void {
  if (typeof window === "undefined") return;
  const next = [petId, ...getRecentPatientIds().filter((id) => id !== petId)].slice(0, 12);
  sessionStorage.setItem(RECENT_PATIENTS_KEY, JSON.stringify(next));
}

export async function getRecentPatients(): Promise<Pet[]> {
  const ids = getRecentPatientIds();
  if (!ids.length) return [];
  const pets = await Promise.all(ids.map((id) => getPetRecordById(id)));
  return pets.filter((pet): pet is Pet => Boolean(pet));
}

export async function lookupPatientByTag(raw: string): Promise<Pet> {
  const pet = await findPetByTag(raw);
  if (!pet) throw new Error("No patient found for that tag or VetKonnect ID.");
  rememberPatientId(pet.id);
  return pet;
}

export async function prescribeTreatment(input: PrescribeTreatmentInput): Promise<Pet> {
  const user = await getUser();
  if (!user.id || user.accountType !== "vet") {
    throw new Error("Only verified vet accounts can prescribe treatment.");
  }
  if (!user.vetVerified) {
    throw new Error("Your vet account must be verified before updating health cards.");
  }

  const title = input.title.trim();
  const detail = input.detail.trim();
  if (title.length < 2) throw new Error("Add a treatment title.");
  if (detail.length < 2) throw new Error("Add treatment details.");

  const pet = await getPetRecordById(input.petId);
  if (!pet) throw new Error("Patient not found.");

  const event = {
    id: crypto.randomUUID(),
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
    title,
    detail: `${detail}${user.fullName ? ` · Prescribed by ${user.fullName}` : ""}`,
    type: "treatment" as const,
  };

  const updated = await updatePet(pet.id, {
    timeline: [event, ...(pet.timeline ?? [])],
    medicationToday: input.medicationToday?.trim() || pet.medicationToday,
    healthStatus: input.healthStatus ?? pet.healthStatus,
    nextVaccine: input.nextVaccine?.trim() || pet.nextVaccine,
    weightKg: input.weightKg != null && !Number.isNaN(input.weightKg) ? input.weightKg : pet.weightKg,
  });

  if (!updated) throw new Error("Could not update the health card.");

  rememberPatientId(updated.id);
  await updateUser({ patientsServed: Number(user.patientsServed ?? 0) + 1 });

  if (updated.ownerId) {
    await createNotification({
      accountId: updated.ownerId,
      title: `Treatment for ${updated.name}`,
      body: `${title}: ${detail}`,
      type: "health",
    });
  }

  return updated;
}

/** Owner accounts with pets — treated as potential clients for verified vets. */
export async function getPotentialClients(limit = 40): Promise<PotentialClient[]> {
  const [{ data: accounts, error: accountsError }, { data: pets, error: petsError }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,full_name,phone,created_at,account_type")
      .neq("account_type", "vet")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("pets").select("id,name,owner_id"),
  ]);

  if (accountsError) throw accountsError;
  if (petsError) throw petsError;

  const petsByOwner = new Map<string, string[]>();
  for (const pet of pets ?? []) {
    const ownerId = pet.owner_id ? String(pet.owner_id) : "";
    if (!ownerId) continue;
    const list = petsByOwner.get(ownerId) ?? [];
    list.push(String(pet.name ?? "Pet"));
    petsByOwner.set(ownerId, list);
  }

  return (accounts ?? [])
    .map((row) => {
      const id = String(row.id);
      const petNames = petsByOwner.get(id) ?? [];
      return {
        id,
        fullName: String(row.full_name ?? "").trim() || "Pet owner",
        phone: String(row.phone ?? ""),
        pets: petNames.length,
        petNames,
        memberSince: row.created_at
          ? new Date(String(row.created_at)).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
          : undefined,
      } satisfies PotentialClient;
    })
    .filter((client) => client.pets > 0)
    .slice(0, limit);
}

export async function requestPracticeDashboard(): Promise<void> {
  const user = await getUser();
  if (!user.id) throw new Error("Sign in to request a practice dashboard.");

  await createNotification({
    accountId: user.id,
    title: "Practice dashboard requested",
    body: "Your request was sent to VetKonnect admin. We'll follow up after verification.",
    type: "system",
  });

  await updateUser({
    practiceName: user.practiceName?.trim() || `${user.fullName}'s Practice`,
  });
}
