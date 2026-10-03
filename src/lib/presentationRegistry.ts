import type { RegistryCertificate, RegistryLicence, RegistryPet, RegistryVaccination } from "@/lib/dvsDemographics";
import { getAllPets } from "@/services/petService";
import { supabase } from "@/services/supabaseClient";

export type PresentationRegistry = {
  pets: RegistryPet[];
  certificates: RegistryCertificate[];
  vaccinations: RegistryVaccination[];
  licences: RegistryLicence[];
};

function missingTable(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return error.code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("permission denied");
}

async function rows(table: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.from(table).select("*");
  if (error) {
    if (missingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as Record<string, unknown>[];
}

/** Public read of the national register for the authority presentation. No login. */
export async function loadPresentationRegistry(): Promise<PresentationRegistry> {
  const [pets, certificateRows, vaccinationRows, licenceRows] = await Promise.all([
    getAllPets().catch(() => []),
    rows("dvs_certificates"),
    rows("dvs_vaccinations"),
    rows("dvs_animal_licences"),
  ]);

  return {
    pets,
    certificates: certificateRows.map((row) => ({
      petId: row.pet_id ? String(row.pet_id) : null,
      province: row.province ? String(row.province) : undefined,
    })),
    vaccinations: vaccinationRows.map((row) => ({
      petId: row.pet_id ? String(row.pet_id) : null,
      province: row.province ? String(row.province) : undefined,
      status: row.status ? String(row.status) : undefined,
    })),
    licences: licenceRows.map((row) => ({
      petId: row.pet_id ? String(row.pet_id) : null,
      status: row.status ? String(row.status) : undefined,
    })),
  };
}
