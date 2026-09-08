import type { NewPetInput, Pet } from "@/types";
import { withTimeout } from "@/lib/timeout";
import { getSessionAccountId } from "./userService";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

function createVetKonnectId(): string {
  const suffix = Math.floor(100000 + Math.random() * 900000).toString();
  return `VK-ZW-${suffix}`;
}

function createQrPayload(pet: Pet): string {
  return JSON.stringify({
    id: pet.id,
    vetConnectId: pet.vetConnectId,
    collarId: pet.collarId,
    name: pet.name,
    species: pet.species,
    vetSure: pet.vetSure,
  });
}

export async function uploadPetPhoto(file: File, petId?: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Photo must be under 8MB.");
  }

  const accountId = getSessionAccountId() ?? "guest";
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext) ? ext : "jpg";
  const path = `${accountId}/${petId ?? "new"}-${Date.now()}.${safeExt}`;

  const { error } = await supabase.storage.from("pet-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("pet-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function getPets(ownerId?: string): Promise<Pet[]> {
  const accountId = ownerId ?? getSessionAccountId();
  if (!accountId || !isSupabaseConfigured) return [];

  try {
    const { data, error } = await withTimeout(
      supabase.from("pets").select("*").eq("owner_id", accountId).order("created_at", { ascending: true }),
      5000,
      "Pets",
    );
    if (error) throw error;
    return (data ?? []).map(mapPetRow);
  } catch (error) {
    console.error("Failed to load pets", error);
    return [];
  }
}

/** Admin listing — all pets regardless of owner. */
export async function getAllPets(): Promise<Pet[]> {
  const { data, error } = await supabase.from("pets").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapPetRow);
}

export async function getPetById(id: string): Promise<Pet | undefined> {
  const pets = await getPets();
  return pets.find((p) => p.id === id);
}

export async function createPet(input: NewPetInput): Promise<Pet> {
  const ownerId = getSessionAccountId();
  if (!ownerId) throw new Error("You must be logged in to add a pet.");

  const id = crypto.randomUUID();
  const vetConnectId = createVetKonnectId();
  const pet: Pet = {
    ...input,
    collarId: input.collarId?.trim() || undefined,
    id,
    ownerId,
    vetConnectId,
    healthStatus: "Healthy",
    weightKg: 0,
    nextVaccine: "Not scheduled",
    medicationToday: "None Today",
    vetSure: false,
    timeline: [
      {
        id: crypto.randomUUID(),
        date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
        title: "Digital pet profile created",
        detail: "Health passport activated on VetKonnect.",
        type: "checkup",
      },
    ],
  };

  const petWithQr: Pet = {
    ...pet,
    qrPayload: createQrPayload(pet),
  };

  const { error } = await supabase.from("pets").upsert(
    {
      id: petWithQr.id,
      owner_id: ownerId,
      vetconnect_id: petWithQr.vetConnectId,
      collar_id: petWithQr.collarId ?? null,
      name: petWithQr.name,
      species: petWithQr.species,
      breed: petWithQr.breed,
      sex: petWithQr.sex,
      age_years: petWithQr.ageYears,
      colour: petWithQr.colour,
      microchip: petWithQr.microchip ?? null,
      photo_url: petWithQr.photoUrl,
      health_status: petWithQr.healthStatus,
      weight_kg: petWithQr.weightKg,
      next_vaccine: petWithQr.nextVaccine,
      medication_today: petWithQr.medicationToday,
      vet_sure: petWithQr.vetSure,
      timeline: petWithQr.timeline,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  return petWithQr;
}

export async function updatePet(id: string, patch: Partial<Pet>): Promise<Pet | undefined> {
  const { data: existing, error: lookupError } = await supabase.from("pets").select("*").eq("id", id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) return undefined;

  const current = mapPetRow(existing as Record<string, unknown>);
  const updated = { ...current, ...patch };
  const { error } = await supabase
    .from("pets")
    .update({
      owner_id: updated.ownerId ?? current.ownerId ?? null,
      vetconnect_id: updated.vetConnectId,
      collar_id: updated.collarId ?? null,
      name: updated.name,
      species: updated.species,
      breed: updated.breed,
      sex: updated.sex,
      age_years: updated.ageYears,
      colour: updated.colour,
      microchip: updated.microchip ?? null,
      photo_url: updated.photoUrl,
      health_status: updated.healthStatus,
      weight_kg: updated.weightKg,
      next_vaccine: updated.nextVaccine,
      medication_today: updated.medicationToday,
      vet_sure: updated.vetSure,
      timeline: updated.timeline,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  return updated;
}

export async function deletePet(id: string): Promise<void> {
  const { error } = await supabase.from("pets").delete().eq("id", id);
  if (error) throw error;
}

export async function savePets(pets: Pet[]): Promise<void> {
  const ownerId = getSessionAccountId();
  const rows = pets.map((pet) => ({
    id: pet.id,
    owner_id: pet.ownerId ?? ownerId,
    vetconnect_id: pet.vetConnectId,
    collar_id: pet.collarId ?? null,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    age_years: pet.ageYears,
    colour: pet.colour,
    microchip: pet.microchip ?? null,
    photo_url: pet.photoUrl,
    health_status: pet.healthStatus,
    weight_kg: pet.weightKg,
    next_vaccine: pet.nextVaccine,
    medication_today: pet.medicationToday,
    vet_sure: pet.vetSure,
    timeline: pet.timeline,
  }));
  const { error } = await supabase.from("pets").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

function mapPetRow(row: Record<string, unknown>): Pet {
  return {
    id: String(row.id),
    ownerId: row.owner_id ? String(row.owner_id) : undefined,
    vetConnectId: String(row.vetconnect_id ?? ""),
    collarId: row.collar_id ? String(row.collar_id) : undefined,
    name: String(row.name ?? ""),
    species: row.species as Pet["species"],
    breed: String(row.breed ?? ""),
    sex: row.sex as Pet["sex"],
    ageYears: Number(row.age_years ?? 0),
    colour: String(row.colour ?? ""),
    microchip: row.microchip ? String(row.microchip) : undefined,
    photoUrl: String(row.photo_url ?? ""),
    healthStatus: (row.health_status as Pet["healthStatus"]) || "Healthy",
    weightKg: Number(row.weight_kg ?? 0),
    nextVaccine: String(row.next_vaccine ?? "Not scheduled"),
    medicationToday: String(row.medication_today ?? "None Today"),
    vetSure: Boolean(row.vet_sure),
    timeline: (row.timeline ?? []) as Pet["timeline"],
  };
}
