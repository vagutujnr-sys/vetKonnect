import type { HealthStatus, Pet, PotentialClient } from "@/types";
import { haversineKm, HARARE, type GeoPoint } from "@/lib/geo";
import { createNotification, notifyAccount } from "./notificationService";
import { findPetByTag, getPetRecordById, updatePet } from "./petService";
import { supabase } from "./supabaseClient";
import { getUser, updateUser } from "./userService";

const RECENT_PATIENTS_KEY = "vetkonnect:recent_patients";

/** Stable map placement around an origin until owners store real coordinates. */
function approximateOwnerPoint(ownerId: string, origin: GeoPoint): GeoPoint {
  let hash = 0;
  for (let i = 0; i < ownerId.length; i += 1) {
    hash = (hash * 31 + ownerId.charCodeAt(i)) >>> 0;
  }
  const angle = ((hash % 360) * Math.PI) / 180;
  const radiusKm = 1.2 + (hash % 90) / 12; // ~1.2–8.7 km
  const dLat = (radiusKm / 111) * Math.cos(angle);
  const cosLat = Math.cos((origin.latitude * Math.PI) / 180) || 0.95;
  const dLng = (radiusKm / (111 * cosLat)) * Math.sin(angle);
  return {
    latitude: origin.latitude + dLat,
    longitude: origin.longitude + dLng,
  };
}

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

/** Owner accounts with pets — mapped near the logged-in vet for Impact. */
export async function getPotentialClients(
  origin: GeoPoint = HARARE,
  limit = 60,
): Promise<PotentialClient[]> {
  const [{ data: accounts, error: accountsError }, { data: pets, error: petsError }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,full_name,created_at,account_type,latitude,longitude,avatar_url")
      .neq("account_type", "vet")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("pets").select("id,name,owner_id"),
  ]);

  if (accountsError) {
    // Fallback if lat/lng columns are not migrated yet.
    const { data: basicAccounts, error: basicError } = await supabase
      .from("accounts")
      .select("id,full_name,created_at,account_type,avatar_url")
      .neq("account_type", "vet")
      .order("created_at", { ascending: false })
      .limit(200);
    if (basicError) throw basicError;
    return mapPotentialClients(basicAccounts ?? [], pets ?? [], origin, limit);
  }
  if (petsError) throw petsError;

  return mapPotentialClients(accounts ?? [], pets ?? [], origin, limit);
}

function mapPotentialClients(
  accounts: Array<Record<string, unknown>>,
  pets: Array<Record<string, unknown>>,
  origin: GeoPoint,
  limit: number,
): PotentialClient[] {
  const petsByOwner = new Map<string, string[]>();
  for (const pet of pets) {
    const ownerId = pet.owner_id ? String(pet.owner_id) : "";
    if (!ownerId) continue;
    const list = petsByOwner.get(ownerId) ?? [];
    list.push(String(pet.name ?? "Pet"));
    petsByOwner.set(ownerId, list);
  }

  return accounts
    .map((row) => {
      const id = String(row.id);
      const petNames = petsByOwner.get(id) ?? [];
      const hasStored =
        row.latitude != null &&
        row.longitude != null &&
        !Number.isNaN(Number(row.latitude)) &&
        !Number.isNaN(Number(row.longitude));
      const point = hasStored
        ? { latitude: Number(row.latitude), longitude: Number(row.longitude) }
        : approximateOwnerPoint(id, origin);

      return {
        id,
        fullName: String(row.full_name ?? "").trim() || "Pet owner",
        pets: petNames.length,
        petNames,
        memberSince: row.created_at
          ? new Date(String(row.created_at)).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
          : undefined,
        latitude: point.latitude,
        longitude: point.longitude,
        distanceKm: haversineKm(origin, point),
        avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
        approximate: !hasStored,
      } satisfies PotentialClient;
    })
    .filter((client) => client.pets > 0)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export async function requestPracticeDashboard(): Promise<void> {
  const user = await getUser();
  if (!user.id) throw new Error("Sign in to request a practice dashboard.");
  if (user.accountType !== "vet") throw new Error("Only vet accounts can request a practice dashboard.");
  if (user.vetVerified) throw new Error("Your practice dashboard is already unlocked.");

  const practiceName = user.practiceName?.trim() || `${user.fullName?.trim() || "Vet"}'s Practice`;
  const requestedAt = new Date().toISOString();

  // Always persist practice_name (works without migration 010).
  const { error: practiceError } = await supabase
    .from("accounts")
    .update({
      practice_name: practiceName,
      updated_at: requestedAt,
    })
    .eq("id", user.id);
  if (practiceError) throw practiceError;

  // Best-effort timestamp column when migration 010 is applied.
  const { error: stampError } = await supabase
    .from("accounts")
    .update({ dashboard_requested_at: requestedAt })
    .eq("id", user.id);
  if (stampError) {
    console.warn("dashboard_requested_at unavailable; using notifications + practice_name", stampError.message);
  }

  await updateUser({ practiceName });

  // Self confirmation + durable admin-visible request signal (works without is_admin accounts).
  await createNotification({
    accountId: user.id,
    title: "Practice dashboard requested",
    body: `${practiceName} requested practice access. Approve in Admin → Overview or App Accounts → Pending elevate.`,
    type: "dashboard_request",
  });

  const { data: admins } = await supabase.from("accounts").select("id").eq("is_admin", true);
  const name = user.fullName?.trim() || "A vet";
  const phone = user.phone || "unknown phone";
  await Promise.all(
    (admins ?? [])
      .map((row) => String(row.id))
      .filter((id) => id && id !== user.id)
      .map((adminId) =>
        notifyAccount({
          accountId: adminId,
          title: "Practice dashboard request",
          body: `${name} (${phone}) requested practice access. Open Admin → Pending elevate to approve.`,
          type: "admin",
        }),
      ),
  );
}
