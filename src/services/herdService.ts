import type { Herd, HerdAnimal, HerdAnimalSex, HerdHealthStatus, HerdTreatment } from "@/types";
import { getSessionAccountId } from "./userService";
import { supabase } from "./supabaseClient";

const GROUP_LIMIT = 200;

function missingHerdTable(error: { message?: string; code?: string } | null): Error | null {
  const message = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  if (
    message.includes("herds") ||
    message.includes("herd_animals") ||
    message.includes("schema cache") ||
    error?.code === "PGRST205"
  ) {
    return new Error("Farm herds are not installed yet. Apply migration 026_herds.sql in Supabase.");
  }
  return null;
}

function mapAnimal(row: Record<string, unknown>): HerdAnimal {
  const sex = String(row.sex ?? "Unknown");
  const health = String(row.health_status ?? "Healthy");
  return {
    id: String(row.id),
    herdId: String(row.herd_id),
    ownerId: String(row.owner_id),
    tagNumber: row.tag_number ? String(row.tag_number) : "",
    sex: sex === "Male" || sex === "Female" ? sex : "Unknown",
    healthStatus: health === "Sick" || health === "Under Care" ? health : "Healthy",
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapTreatment(row: Record<string, unknown>): HerdTreatment {
  return {
    id: String(row.id),
    herdId: String(row.herd_id),
    animalId: row.animal_id ? String(row.animal_id) : null,
    title: String(row.title ?? ""),
    detail: String(row.detail ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function mapHerd(row: Record<string, unknown>, animals: HerdAnimal[], treatments: HerdTreatment[] = []): Herd {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name ?? ""),
    species: String(row.species ?? ""),
    location: String(row.location ?? ""),
    notes: String(row.notes ?? ""),
    photoUrl: String(row.photo_url ?? ""),
    createdAt: String(row.created_at ?? ""),
    animals,
    treatments,
  };
}

export async function listHerds(): Promise<Herd[]> {
  const ownerId = getSessionAccountId();
  if (!ownerId) return [];

  const [herdsResult, animalsResult, treatmentsResult] = await Promise.all([
    supabase.from("herds").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }),
    supabase.from("herd_animals").select("*").eq("owner_id", ownerId).order("created_at", { ascending: true }),
    supabase.from("herd_treatments").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false }),
  ]);

  const tableError = missingHerdTable(herdsResult.error) ?? missingHerdTable(animalsResult.error);
  if (tableError) throw tableError;
  if (herdsResult.error) throw herdsResult.error;
  if (animalsResult.error) throw animalsResult.error;

  const treatmentMessage = `${treatmentsResult.error?.message ?? ""}`.toLowerCase();
  const treatmentsMissing =
    Boolean(treatmentsResult.error) &&
    (treatmentMessage.includes("herd_treatments") || treatmentsResult.error?.code === "PGRST205");
  const treatments = treatmentsMissing
    ? []
    : (treatmentsResult.data ?? []).map((row) => mapTreatment(row as Record<string, unknown>));
  if (treatmentsResult.error && !treatmentsMissing) throw treatmentsResult.error;

  const animals = (animalsResult.data ?? []).map((row) => mapAnimal(row as Record<string, unknown>));
  return (herdsResult.data ?? []).map((row) => {
    const herd = row as Record<string, unknown>;
    const id = String(herd.id);
    return mapHerd(
      herd,
      animals.filter((animal) => animal.herdId === id),
      treatments.filter((item) => item.herdId === id),
    );
  });
}

export async function uploadHerdPhoto(file: File, herdId: string): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Photo must be under 8MB.");

  const ownerId = getSessionAccountId();
  if (!ownerId) throw new Error("You must be signed in to add a herd photo.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext) ? ext : "jpg";
  const path = `${ownerId}/herd-${herdId}-${Date.now()}.${safeExt}`;

  const { error } = await supabase.storage.from("pet-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("pet-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function createHerd(input: {
  id?: string;
  name: string;
  species: string;
  location?: string;
  photoUrl: string;
}): Promise<Herd> {
  const ownerId = getSessionAccountId();
  if (!ownerId) throw new Error("You must be signed in to add a herd.");
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Enter a herd name.");
  const photoUrl = input.photoUrl.trim();
  if (!photoUrl) throw new Error("Add a photo of the herd.");

  const row = {
    id: input.id ?? crypto.randomUUID(),
    owner_id: ownerId,
    name,
    species: input.species.trim() || "Cattle",
    location: input.location?.trim() || "",
    notes: "",
    photo_url: photoUrl,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("herds").insert(row);
  const tableError = missingHerdTable(error);
  if (tableError) throw tableError;
  if (error) {
    const message = `${error.message ?? ""}`.toLowerCase();
    if (message.includes("photo_url")) {
      throw new Error("Herd photos are not installed yet. Apply migration 027_herd_photo.sql in Supabase.");
    }
    throw error;
  }

  return mapHerd(row, [], []);
}

export async function recordHerdTreatment(input: {
  herdId: string;
  animalId?: string | null;
  title: string;
  detail?: string;
  healthStatus?: HerdHealthStatus;
}): Promise<void> {
  const ownerId = getSessionAccountId();
  if (!ownerId) throw new Error("You must be signed in to record treatment.");
  const title = input.title.trim();
  if (title.length < 2) throw new Error("Enter what treatment was given.");

  const { error } = await supabase.from("herd_treatments").insert({
    id: crypto.randomUUID(),
    herd_id: input.herdId,
    owner_id: ownerId,
    animal_id: input.animalId || null,
    title,
    detail: input.detail?.trim() || "",
  });
  if (error) {
    const message = `${error.message ?? ""}`.toLowerCase();
    if (message.includes("herd_treatments") || error.code === "PGRST205") {
      throw new Error("Herd treatment notes are not installed yet. Apply migration 028_herd_treatments.sql in Supabase.");
    }
    throw error;
  }

  if (!input.healthStatus) return;
  const animalUpdate = supabase
    .from("herd_animals")
    .update({
      health_status: input.healthStatus,
      notes: input.detail?.trim() || title,
      updated_at: new Date().toISOString(),
    })
    .eq("herd_id", input.herdId);
  const { error: statusError } = input.animalId
    ? await animalUpdate.eq("id", input.animalId)
    : await animalUpdate;
  if (statusError) throw statusError;
}

export async function addAnimalGroup(input: {
  herdId: string;
  count: number;
  sex: HerdAnimalSex;
}): Promise<void> {
  const ownerId = getSessionAccountId();
  if (!ownerId) throw new Error("You must be signed in to add animals.");
  const count = Math.min(GROUP_LIMIT, Math.max(1, Math.floor(input.count)));
  const now = new Date().toISOString();
  const rows = Array.from({ length: count }, () => ({
    id: crypto.randomUUID(),
    herd_id: input.herdId,
    owner_id: ownerId,
    tag_number: null,
    sex: input.sex,
    health_status: "Healthy",
    notes: "",
    updated_at: now,
  }));

  const { error } = await supabase.from("herd_animals").insert(rows);
  const tableError = missingHerdTable(error);
  if (tableError) throw tableError;
  if (error) throw error;
}

export async function updateHerdAnimal(
  id: string,
  patch: { tagNumber?: string; healthStatus?: HerdHealthStatus },
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.tagNumber !== undefined) payload.tag_number = patch.tagNumber.trim() || null;
  if (patch.healthStatus !== undefined) payload.health_status = patch.healthStatus;

  const { error } = await supabase.from("herd_animals").update(payload).eq("id", id);
  if (error) {
    const message = `${error.message ?? ""}`.toLowerCase();
    if (message.includes("herd_animals_tag_unique") || error.code === "23505") {
      throw new Error("That tag number is already used in this herd.");
    }
    const tableError = missingHerdTable(error);
    if (tableError) throw tableError;
    throw error;
  }
}
