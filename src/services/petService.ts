import { mockPets } from "@/data/mockPets";
import type { NewPetInput, Pet } from "@/types";
import { delay, readLocal, writeLocal } from "./storage";

const KEY = "vetconnect.pets";

/**
 * Pet data access. Every function is async so the implementation can be
 * swapped for real database queries without touching the UI.
 */
export async function getPets(): Promise<Pet[]> {
  await delay();
  return readLocal<Pet[]>(KEY, mockPets);
}

export async function getPetById(id: string): Promise<Pet | undefined> {
  const pets = await getPets();
  return pets.find((p) => p.id === id);
}

export async function createPet(input: NewPetInput): Promise<Pet> {
  const pets = await getPets();
  const pet: Pet = {
    ...input,
    id: `pet-${Date.now()}`,
    vetConnectId: `VC-ZW-${Math.floor(100000 + Math.random() * 899999)}`,
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
  const next = [...pets, pet];
  writeLocal(KEY, next);
  return pet;
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
  writeLocal(KEY, pets);
}
