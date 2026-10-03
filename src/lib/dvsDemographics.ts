import { assignRegionFromSeed, DVS_REGIONS, type DvsProvinceName } from "@/lib/dvsRegions";
import type { Pet } from "@/types";

export type RegistryPet = Pick<Pet, "id" | "ownerId" | "species" | "sex" | "ageYears" | "nextVaccine" | "timeline">;
export type RegistryCertificate = { petId?: string | null; province?: string };
export type RegistryVaccination = { petId?: string | null; province?: string; status?: string };
export type RegistryLicence = { petId?: string | null; status?: string };

export type DemographicLens = "animals" | "dogs" | "coverage" | "licensed" | "owners";

export type ProvinceDemographics = {
  province: DvsProvinceName;
  latitude: number;
  longitude: number;
  animals: number;
  dogs: number;
  cats: number;
  birds: number;
  other: number;
  male: number;
  female: number;
  young: number;
  adult: number;
  senior: number;
  owners: number;
  licensed: number;
  vaccinated: number;
  coveragePct: number;
  licencePct: number;
};

export type DemographicSummary = {
  animals: number;
  dogs: number;
  cats: number;
  birds: number;
  other: number;
  male: number;
  female: number;
  owners: number;
  licensed: number;
  unlicensed: number;
  vaccinated: number;
  coveragePct: number;
  licencePct: number;
  dogShare: number;
  provincesWithAnimals: number;
  weakest: ProvinceDemographics | null;
};

function speciesBucket(species: string): "dogs" | "cats" | "birds" | "other" {
  const key = species.toLowerCase();
  if (key.includes("dog")) return "dogs";
  if (key.includes("cat")) return "cats";
  if (key.includes("bird")) return "birds";
  return "other";
}

function hasRabiesRecord(pet: RegistryPet, vaccinatedIds: Set<string>): boolean {
  if (vaccinatedIds.has(pet.id)) return true;
  if ((pet.nextVaccine ?? "").toLowerCase().includes("rabies")) return true;
  return (pet.timeline ?? []).some((event) => {
    const blob = `${event.title} ${event.detail}`.toLowerCase();
    return event.type === "vaccine" && blob.includes("rabies");
  });
}

function provinceForPet(
  petId: string,
  recorded: Map<string, string>,
): DvsProvinceName {
  const named = recorded.get(petId);
  if (named && DVS_REGIONS.some((region) => region.province === named)) {
    return named as DvsProvinceName;
  }
  return assignRegionFromSeed(petId).province;
}

export function buildProvinceDemographics(input: {
  pets: RegistryPet[];
  certificates: RegistryCertificate[];
  vaccinations: RegistryVaccination[];
  licences: RegistryLicence[];
}): ProvinceDemographics[] {
  const recorded = new Map<string, string>();
  for (const cert of input.certificates) {
    if (cert.petId && cert.province) recorded.set(cert.petId, cert.province);
  }
  for (const vax of input.vaccinations) {
    if (vax.petId && vax.province && !recorded.has(vax.petId)) recorded.set(vax.petId, vax.province);
  }

  const vaccinatedIds = new Set(
    input.vaccinations.filter((item) => item.status === "administered" && item.petId).map((item) => item.petId as string),
  );
  const licensedIds = new Set(
    input.licences.filter((item) => item.status === "active" && item.petId).map((item) => item.petId as string),
  );

  const buckets = new Map<DvsProvinceName, ProvinceDemographics & { ownerIds: Set<string> }>();
  for (const region of DVS_REGIONS) {
    buckets.set(region.province, {
      province: region.province,
      latitude: region.latitude,
      longitude: region.longitude,
      animals: 0,
      dogs: 0,
      cats: 0,
      birds: 0,
      other: 0,
      male: 0,
      female: 0,
      young: 0,
      adult: 0,
      senior: 0,
      owners: 0,
      licensed: 0,
      vaccinated: 0,
      coveragePct: 0,
      licencePct: 0,
      ownerIds: new Set(),
    });
  }

  for (const pet of input.pets) {
    const bucket = buckets.get(provinceForPet(pet.id, recorded));
    if (!bucket) continue;
    bucket.animals += 1;
    bucket[speciesBucket(pet.species)] += 1;
    if (pet.sex === "Male") bucket.male += 1;
    if (pet.sex === "Female") bucket.female += 1;
    if (pet.ageYears < 2) bucket.young += 1;
    else if (pet.ageYears < 8) bucket.adult += 1;
    else bucket.senior += 1;
    if (pet.ownerId) bucket.ownerIds.add(pet.ownerId);
    if (licensedIds.has(pet.id)) bucket.licensed += 1;
    if (hasRabiesRecord(pet, vaccinatedIds)) bucket.vaccinated += 1;
  }

  return DVS_REGIONS.map((region) => {
    const bucket = buckets.get(region.province)!;
    const { ownerIds, ...row } = bucket;
    row.owners = ownerIds.size;
    row.coveragePct = row.animals === 0 ? 0 : Math.round((row.vaccinated / row.animals) * 100);
    row.licencePct = row.animals === 0 ? 0 : Math.round((row.licensed / row.animals) * 100);
    return row;
  });
}

export function summariseDemographics(rows: ProvinceDemographics[]): DemographicSummary {
  const sum = (pick: (row: ProvinceDemographics) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const animals = sum((row) => row.animals);
  const vaccinated = sum((row) => row.vaccinated);
  const licensed = sum((row) => row.licensed);
  const dogs = sum((row) => row.dogs);
  const withAnimals = rows.filter((row) => row.animals > 0);
  const weakest = [...withAnimals].sort((a, b) => a.coveragePct - b.coveragePct)[0] ?? null;
  return {
    animals,
    dogs,
    cats: sum((row) => row.cats),
    birds: sum((row) => row.birds),
    other: sum((row) => row.other),
    male: sum((row) => row.male),
    female: sum((row) => row.female),
    owners: sum((row) => row.owners),
    licensed,
    unlicensed: Math.max(0, animals - licensed),
    vaccinated,
    coveragePct: animals === 0 ? 0 : Math.round((vaccinated / animals) * 100),
    licencePct: animals === 0 ? 0 : Math.round((licensed / animals) * 100),
    dogShare: animals === 0 ? 0 : Math.round((dogs / animals) * 100),
    provincesWithAnimals: withAnimals.length,
    weakest,
  };
}

export function lensMetric(row: ProvinceDemographics, lens: DemographicLens): number {
  if (lens === "dogs") return row.dogs;
  if (lens === "coverage") return row.coveragePct;
  if (lens === "licensed") return row.licencePct;
  if (lens === "owners") return row.owners;
  return row.animals;
}

export function lensColor(value: number, max: number, lens: DemographicLens): string {
  if (lens === "coverage" || lens === "licensed") {
    if (value >= 70) return "#0f766e";
    if (value >= 40) return "#d97706";
    return "#b91c1c";
  }
  if (value <= 0 || max <= 0) return "#94a3b8";
  const share = value / max;
  if (share > 0.66) return "#123524";
  if (share > 0.33) return "#0f766e";
  return "#5eead4";
}
