import { coordsForRabiesPlace } from "@/lib/dvsRabiesLocations";
import {
  createRabiesCase,
  findOrCreateVaccineBatch,
  issueDvsCertificate,
  listAnimalHealthReports,
  listCertificatesForPet,
  listDvsBatches,
  listDvsCertificates,
  listRecognisedVaccines,
  listVetCaseReports,
  lookupOwner,
  searchDvsAnimals,
  writeAudit,
} from "@/services/dvsService";
import { updatePet } from "@/services/petService";
import { supabase } from "@/services/supabaseClient";
import { getUser } from "@/services/userService";
import type {
  DvsAnimalHealthReport,
  DvsCertificate,
  DvsHealthReportType,
  DvsRabiesCaseStatus,
  DvsRecognisedVaccine,
  DvsVaccineBatch,
  DvsVetCaseReport,
  Pet,
  VetPracticeNote,
} from "@/types";

function requireVerifiedVet() {
  return getUser().then((user) => {
    if (!user.id || user.accountType !== "vet") {
      throw new Error("Only veterinary accounts can use the practice dashboard.");
    }
    if (!user.vetVerified) {
      throw new Error("Your practice must be verified before submitting to DVS.");
    }
    return user;
  });
}

function mapNote(row: Record<string, unknown>): VetPracticeNote {
  return {
    id: String(row.id),
    veterinarianAccountId: String(row.veterinarian_account_id ?? ""),
    petId: row.pet_id ? String(row.pet_id) : null,
    petName: row.pet_name ? String(row.pet_name) : undefined,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function listVetPracticeNotes(): Promise<VetPracticeNote[]> {
  const user = await requireVerifiedVet();
  const { data, error } = await supabase
    .from("vet_practice_notes")
    .select("*")
    .eq("veterinarian_account_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) {
    if (String(error.message ?? "").toLowerCase().includes("does not exist") || error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []).map((row) => mapNote(row as Record<string, unknown>));
}

export async function saveVetPracticeNote(input: {
  id?: string;
  title: string;
  body: string;
  petId?: string;
  petName?: string;
}): Promise<VetPracticeNote> {
  const user = await requireVerifiedVet();
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 2) throw new Error("Add a note title.");
  if (body.length < 2) throw new Error("Add note details.");
  const payload = {
    veterinarian_account_id: user.id,
    pet_id: input.petId || null,
    pet_name: input.petName?.trim() || null,
    title,
    body,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("vet_practice_notes")
      .update(payload)
      .eq("id", input.id)
      .eq("veterinarian_account_id", user.id)
      .select("*")
      .single();
    if (error) throw error;
    return mapNote(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from("vet_practice_notes")
    .insert({ id: crypto.randomUUID(), ...payload })
    .select("*")
    .single();
  if (error) throw error;
  return mapNote(data as Record<string, unknown>);
}

export async function deleteVetPracticeNote(id: string): Promise<void> {
  const user = await requireVerifiedVet();
  const { error } = await supabase.from("vet_practice_notes").delete().eq("id", id).eq("veterinarian_account_id", user.id);
  if (error) throw error;
}

export async function reportCaseToDvs(input: {
  status: DvsRabiesCaseStatus;
  species?: string;
  petId?: string;
  petName?: string;
  province?: string;
  district?: string;
  locationLabel?: string;
  vaccinationStatus?: string;
  notes?: string;
}): Promise<DvsVetCaseReport> {
  const user = await requireVerifiedVet();
  const rabiesCase = await createRabiesCase({
    status: input.status,
    species: input.species,
    petId: input.petId,
    petName: input.petName,
    province: input.province,
    district: input.district,
    locationLabel: input.locationLabel,
    vaccinationStatus: input.vaccinationStatus,
    notes: `${input.notes || "Reported by veterinary practice."} [Vet report]`,
    veterinarianAccountId: user.id,
    source: "vet",
  });
  const place = coordsForRabiesPlace(input.province, input.district, input.locationLabel);
  const { data, error } = await supabase
    .from("dvs_vet_case_reports")
    .insert({
      id: crypto.randomUUID(),
      veterinarian_account_id: user.id,
      veterinarian_name: user.fullName,
      practice_name: user.practiceName || null,
      pet_id: input.petId || null,
      pet_name: input.petName || rabiesCase.petName || null,
      species: input.species || "Dog",
      case_status: input.status,
      province: input.province || place?.province || null,
      district: input.district || place?.district || null,
      location_label: input.locationLabel || place?.locationLabel || null,
      latitude: rabiesCase.latitude,
      longitude: rabiesCase.longitude,
      vaccination_status: input.vaccinationStatus || null,
      notes: input.notes || null,
      rabies_case_id: rabiesCase.id,
      review_status: "submitted",
    })
    .select("*")
    .single();
  if (error) throw error;
  await writeAudit({
    actorType: "vet",
    actorId: user.id,
    actorName: user.fullName,
    action: "report_rabies_case",
    entityType: "vet_case_report",
    entityId: String((data as Record<string, unknown>).id),
    detail: { status: input.status, province: input.province, petName: input.petName },
  });
  return {
    id: String((data as Record<string, unknown>).id),
    veterinarianAccountId: user.id,
    veterinarianName: user.fullName,
    practiceName: user.practiceName,
    petId: input.petId || null,
    petName: input.petName,
    species: input.species,
    caseStatus: input.status,
    province: input.province,
    district: input.district,
    locationLabel: input.locationLabel,
    latitude: rabiesCase.latitude,
    longitude: rabiesCase.longitude,
    vaccinationStatus: input.vaccinationStatus,
    notes: input.notes,
    rabiesCaseId: rabiesCase.id,
    reviewStatus: "submitted",
    reportedAt: String((data as Record<string, unknown>).reported_at ?? new Date().toISOString()),
  };
}

export async function submitAnimalHealthReport(input: {
  reportType: DvsHealthReportType;
  title: string;
  body: string;
  province?: string;
  district?: string;
  petId?: string;
}): Promise<DvsAnimalHealthReport> {
  const user = await requireVerifiedVet();
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3) throw new Error("Add a report title.");
  if (body.length < 8) throw new Error("Add report details for DVS.");
  const { data, error } = await supabase
    .from("dvs_animal_health_reports")
    .insert({
      id: crypto.randomUUID(),
      veterinarian_account_id: user.id,
      veterinarian_name: user.fullName,
      practice_name: user.practiceName || null,
      report_type: input.reportType,
      title,
      body,
      province: input.province || null,
      district: input.district || null,
      pet_id: input.petId || null,
      review_status: "submitted",
    })
    .select("*")
    .single();
  if (error) throw error;
  const row = data as Record<string, unknown>;
  await writeAudit({
    actorType: "vet",
    actorId: user.id,
    actorName: user.fullName,
    action: "submit_health_report",
    entityType: "animal_health_report",
    entityId: String(row.id),
    detail: { title, reportType: input.reportType },
  });
  return {
    id: String(row.id),
    veterinarianAccountId: user.id,
    veterinarianName: user.fullName,
    practiceName: user.practiceName,
    reportType: input.reportType,
    title,
    body,
    province: input.province,
    district: input.district,
    petId: input.petId || null,
    reviewStatus: "submitted",
    submittedAt: String(row.submitted_at ?? new Date().toISOString()),
    acknowledgedAt: null,
  };
}

export async function issueVetRabiesCertificate(input: {
  pet: Pet;
  vaccine: DvsRecognisedVaccine;
  batchNumber: string;
  batchExpiry?: string;
  vaccinatedAt: string;
  province: string;
  district: string;
  notes?: string;
}): Promise<DvsCertificate> {
  const user = await requireVerifiedVet();
  const batch = await findOrCreateVaccineBatch({
    manufacturer: input.vaccine.manufacturer,
    batchNumber: input.batchNumber,
    vaccineName: input.vaccine.name,
    vaccineId: input.vaccine.id,
    expiryDate: input.batchExpiry,
    quantityReceived: 0,
    veterinarianAccountId: user.id,
    source: "vet",
  });
  let ownerName = "";
  let ownerPhone = "";
  if (input.pet.ownerId) {
    const owner = await lookupOwner(input.pet.ownerId);
    ownerName = owner?.fullName ?? "";
    ownerPhone = owner?.phone ?? "";
  }
  const cert = await issueDvsCertificate({
    pet: input.pet,
    ownerName,
    ownerPhone,
    veterinarianAccountId: user.id,
    veterinarianName: user.fullName || "Veterinarian",
    practiceId: user.surgeryId,
    practiceName: user.practiceName || "Veterinary practice",
    batch,
    vaccine: input.vaccine,
    vaccinatedAt: input.vaccinatedAt,
    province: input.province,
    district: input.district,
    notes: input.notes,
    notifyOwner: true,
    issuedByVet: true,
  });

  const nextDue = cert.expiresAt
    ? new Date(cert.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : input.pet.nextVaccine;
  const event = {
    id: crypto.randomUUID(),
    date: new Date(input.vaccinatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
    title: `Rabies vaccination — ${input.vaccine.name}`,
    detail: `Batch ${batch.batchNumber} · Certificate ${cert.certificateNumber}${user.fullName ? ` · ${user.fullName}` : ""}`,
    type: "vaccine" as const,
  };
  await updatePet(input.pet.id, {
    timeline: [event, ...(input.pet.timeline ?? [])],
    nextVaccine: nextDue,
  });

  return cert;
}

export async function recordVetVaccineBatch(input: {
  vaccine: DvsRecognisedVaccine;
  batchNumber: string;
  expiryDate?: string;
  quantityReceived?: number;
}): Promise<DvsVaccineBatch> {
  const user = await requireVerifiedVet();
  return findOrCreateVaccineBatch({
    manufacturer: input.vaccine.manufacturer,
    batchNumber: input.batchNumber,
    vaccineName: input.vaccine.name,
    vaccineId: input.vaccine.id,
    expiryDate: input.expiryDate,
    quantityReceived: input.quantityReceived ?? 0,
    veterinarianAccountId: user.id,
    source: "vet",
  });
}

export type VetDashboardSnapshot = {
  vaccines: DvsRecognisedVaccine[];
  myBatches: DvsVaccineBatch[];
  myCertificates: DvsCertificate[];
  myCaseReports: DvsVetCaseReport[];
  myHealthReports: DvsAnimalHealthReport[];
  notes: VetPracticeNote[];
};

export async function getVetDashboardSnapshot(): Promise<VetDashboardSnapshot> {
  const user = await requireVerifiedVet();
  const [vaccines, batches, certificates, caseReports, healthReports, notes] = await Promise.all([
    listRecognisedVaccines(),
    listDvsBatches(),
    listDvsCertificates(),
    listVetCaseReports(),
    listAnimalHealthReports(),
    listVetPracticeNotes(),
  ]);
  return {
    vaccines: vaccines.filter((item) => item.active),
    myBatches: batches.filter((item) => item.veterinarianAccountId === user.id || item.source === "vet"),
    myCertificates: certificates.filter((item) => item.veterinarianAccountId === user.id),
    myCaseReports: caseReports.filter((item) => item.veterinarianAccountId === user.id),
    myHealthReports: healthReports.filter((item) => item.veterinarianAccountId === user.id),
    notes,
  };
}

export { listCertificatesForPet, lookupOwner, searchDvsAnimals, type DvsAnimalSearchResult };
