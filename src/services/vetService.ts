import type { HealthStatus, Pet, PotentialClient } from "@/types";
import { haversineKm, HARARE, type GeoPoint } from "@/lib/geo";
import {
  buildVisitMeeting,
  buildVisitReceipt,
  formatVisitWhen,
  toWhatsAppDigits,
  whatsAppComposeUrl,
} from "@/lib/whatsapp";
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
  serviceProvided?: string;
  visitNotes?: string;
  nextVaccine?: string;
  weightKg?: number;
  followUpDate: string;
  followUpTime: string;
};

export type TreatmentVisitResult = {
  pet: Pet;
  /** sent = Twilio delivered both messages. ready = Twilio is not configured yet. opted_out = owner has not allowed WhatsApp. */
  whatsapp: "sent" | "ready" | "no_phone" | "opted_out" | "failed";
  whatsappUrl?: string;
  whatsappError?: string;
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

async function ownerPhone(
  ownerId: string,
): Promise<{ phone: string; countryCode: string; name: string; whatsappOptIn: boolean } | null> {
  let result = await supabase
    .from("accounts")
    .select("phone,country_code,full_name,whatsapp_opt_in")
    .eq("id", ownerId)
    .maybeSingle();
  if (result.error && `${result.error.message ?? ""}`.toLowerCase().includes("whatsapp_opt_in")) {
    result = await supabase.from("accounts").select("phone,country_code,full_name").eq("id", ownerId).maybeSingle();
  }
  const { data, error } = result;
  if (error || !data) return null;
  const phone = String(data.phone ?? "").trim();
  if (!phone) return null;
  return {
    phone,
    countryCode: String(data.country_code ?? "+263"),
    name: String(data.full_name ?? "").trim(),
    whatsappOptIn: data.whatsapp_opt_in === true,
  };
}

async function deliverOwnerWhatsApp(
  digits: string,
  messages: string[],
): Promise<Pick<TreatmentVisitResult, "whatsapp" | "whatsappError">> {
  try {
    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: digits, messages }),
    });
    const payload = (await response.json()) as { delivered?: boolean; reason?: string; error?: string };
    if (payload.delivered) return { whatsapp: "sent" };
    if (payload.reason === "not_configured") return { whatsapp: "ready" };
    return { whatsapp: "failed", whatsappError: payload.error || "Twilio could not send the WhatsApp message." };
  } catch (error) {
    console.warn("Twilio WhatsApp unavailable", error);
    return { whatsapp: "failed", whatsappError: "Could not reach Twilio." };
  }
}

export async function prescribeTreatment(input: PrescribeTreatmentInput): Promise<TreatmentVisitResult> {
  const user = await getUser();
  if (!user.id || user.accountType !== "vet") {
    throw new Error("Only verified vet accounts can prescribe treatment.");
  }
  if (!user.vetVerified) {
    throw new Error("Your vet account must be verified before updating health cards.");
  }

  const title = input.title.trim();
  const detail = input.detail.trim();
  const serviceProvided = input.serviceProvided?.trim() || "Consultation";
  const visitNotes = input.visitNotes?.trim() || "";
  const followUpDate = input.followUpDate.trim();
  const followUpTime = input.followUpTime.trim() || "09:00";
  if (title.length < 2) throw new Error("Add a treatment title.");
  if (detail.length < 2) throw new Error("Add treatment details.");
  if (!followUpDate) throw new Error("Choose a date for the follow-up visit.");

  const pet = await getPetRecordById(input.petId);
  if (!pet) throw new Error("Patient not found.");

  const overallHealth = input.healthStatus ?? pet.healthStatus;

  const visitedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const when = formatVisitWhen(followUpDate, followUpTime);
  const vetName = user.fullName?.trim() || "Your vet";
  const practiceName = user.practiceName?.trim() || "";

  const event = {
    id: crypto.randomUUID(),
    date: visitedAt,
    title: serviceProvided || title,
    detail: [
      detail,
      visitNotes ? `Notes: ${visitNotes}` : "",
      user.fullName ? `Attended by ${user.fullName}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    type: "treatment" as const,
    service: serviceProvided,
    notes: visitNotes,
    attendedBy: user.fullName || "VetKonnect clinic",
    overallHealth,
  };
  const meeting = {
    id: crypto.randomUUID(),
    date: when,
    title: "Follow-up visit",
    detail: `Scheduled with ${vetName}${practiceName ? ` at ${practiceName}` : ""}.`,
    type: "checkup" as const,
  };

  const updated = await updatePet(pet.id, {
    timeline: [event, meeting, ...(pet.timeline ?? [])],
    medicationToday: input.medicationToday?.trim() || pet.medicationToday,
    healthStatus: input.healthStatus ?? pet.healthStatus,
    nextVaccine: input.nextVaccine?.trim() || pet.nextVaccine,
    weightKg: input.weightKg != null && !Number.isNaN(input.weightKg) ? input.weightKg : pet.weightKg,
    lastAttendedBy: user.fullName || "VetKonnect clinic",
    lastService: serviceProvided,
    lastNotes: visitNotes,
    lastOverallHealth: overallHealth,
  });

  if (!updated) throw new Error("Could not update the health card.");

  rememberPatientId(updated.id);
  await updateUser({ patientsServed: Number(user.patientsServed ?? 0) + 1 });

  const receipt = buildVisitReceipt({
    petName: updated.name,
    species: updated.species,
    treatment: title,
    detail,
    medication: input.medicationToday?.trim(),
    healthStatus: input.healthStatus,
    vetName,
    practiceName,
    visitedAt,
  });
  const meetingNote = buildVisitMeeting({
    petName: updated.name,
    when,
    vetName,
    practiceName,
  });

  if (updated.ownerId) {
    await createNotification({
      accountId: updated.ownerId,
      title: `Receipt for ${updated.name}`,
      body: `${title}: ${detail}`,
      type: "health",
    });
    await createNotification({
      accountId: updated.ownerId,
      title: `Follow-up for ${updated.name}`,
      body: `Visit scheduled ${when}${practiceName ? ` at ${practiceName}` : ""}.`,
      type: "health",
    });
  }

  const owner = updated.ownerId ? await ownerPhone(updated.ownerId) : null;
  const digits = owner ? toWhatsAppDigits(owner.countryCode, owner.phone) : null;
  if (!digits) {
    return { pet: updated, whatsapp: "no_phone" };
  }
  if (!owner?.whatsappOptIn) {
    return { pet: updated, whatsapp: "opted_out" };
  }

  const delivery = await deliverOwnerWhatsApp(digits, [receipt, meetingNote]);
  return {
    pet: updated,
    whatsapp: delivery.whatsapp,
    whatsappError: delivery.whatsappError,
    whatsappUrl: delivery.whatsapp === "ready" ? whatsAppComposeUrl(digits, `${receipt}\n\n${meetingNote}`) : undefined,
  };
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
