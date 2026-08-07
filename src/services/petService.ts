import { mockPets } from "@/data/mockPets";
import type { NewPetInput, Pet } from "@/types";
import { delay, readPersisted, writePersisted } from "./storage";
import { supabase } from "./supabaseClient";

const KEY = "vetconnect.pets";

function createPetId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PET-${stamp}-${random}`;
}

function createVetConnectId(): string {
  const suffix = Math.floor(100000 + Math.random() * 900000).toString();
  return `VC-ZW-${suffix}`;
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

/**
 * Pet data access. Every function is async so the implementation can be
 * swapped for real database queries without touching the UI.
 */
export async function getPets(): Promise<Pet[]> {
  await delay();
  return readPersisted<Pet[]>(KEY, mockPets);
}

export async function getPetById(id: string): Promise<Pet | undefined> {
  const pets = await getPets();
  return pets.find((p) => p.id === id);
}

export async function createPet(input: NewPetInput): Promise<Pet> {
  const pets = await getPets();
  const pet: Pet = {
    ...input,
    collarId: input.collarId?.trim() || undefined,
    id: createPetId(),
    vetConnectId: createVetConnectId(),
    qrPayload: createQrPayload({
      ...input,
      id: createPetId(),
      vetConnectId: createVetConnectId(),
      qrPayload: "",
      healthStatus: "Healthy",
      weightKg: 0,
      nextVaccine: "Not scheduled",
      medicationToday: "None Today",
      vetSure: false,
      timeline: [],
    }),
    healthStatus: "Healthy",
    weightKg: 0,
    nextVaccine: "Not scheduled",
    medicationToday: "None Today",
    vetSure: false,
    timeline: [
      {
        id: `e-${Date.now()}`,
        date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
        title: "Digital pet profile created",
        detail: "Health passport activated on VetConnect.",
        type: "checkup",
      },
    ],
  };

  const petWithQr: Pet = {
    ...pet,
    qrPayload: createQrPayload({ ...pet, qrPayload: undefined }),
  };

  const next = [...pets, petWithQr];
  await writePersisted(KEY, next);

  try {
    await supabase.from("pets").upsert(
      {
        id: petWithQr.id,
        vetconnect_id: petWithQr.vetConnectId,
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
      },
      { onConflict: "id" },
    );
  } catch (error) {
    console.warn("Supabase pet insert failed", error);
  }

  console.info("Pet QR payload", petWithQr.qrPayload);

  return petWithQr;
}

export async function updatePet(id: string, patch: Partial<Pet>): Promise<Pet | undefined> {
  const pets = await getPets();
  const index = pets.findIndex((pet) => pet.id === id);
  if (index === -1) return undefined;
  const updated = { ...pets[index], ...patch };
  pets[index] = updated;
  await savePets(pets);
  return updated;
}

export async function deletePet(id: string): Promise<void> {
  const pets = await getPets();
  await savePets(pets.filter((pet) => pet.id !== id));
}

export async function savePets(pets: Pet[]): Promise<void> {
  await writePersisted(KEY, pets);
}
