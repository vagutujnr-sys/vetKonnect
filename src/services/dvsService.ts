import { coordsForRabiesPlace, DVS_RABIES_DEMO_CASES } from "@/lib/dvsRabiesLocations";
import { assignRegionFromSeed, DVS_REGIONS, regionForProvince } from "@/lib/dvsRegions";
import { notifyAccount } from "@/services/notificationService";
import {
  buildAnimalRegistry,
  buildLicenceFinance,
  listDvsAnimalLicences,
  listDvsLicencePayments,
} from "@/services/dvsLicenceService";
import { getAllPets } from "@/services/petService";
import { supabase } from "@/services/supabaseClient";
import type {
  DvsAlert,
  DvsAnimalHealthReport,
  DvsAuditEntry,
  DvsCertificate,
  DvsCertificateStatus,
  DvsCoverageRow,
  DvsDashboardSnapshot,
  DvsDashboardStats,
  DvsHealthReportReviewStatus,
  DvsMapPoint,
  DvsOfficer,
  DvsOfficerRole,
  DvsPractitionerRow,
  DvsQrScan,
  DvsQrScanResult,
  DvsRabiesCase,
  DvsRabiesCaseStatus,
  DvsRecognisedVaccine,
  DvsSettings,
  DvsVaccination,
  DvsVaccineBatch,
  DvsVetCaseReport,
  DvsVetReportReviewStatus,
  Pet,
} from "@/types";

const SESSION_KEY = "vetkonnect:dvs_session_id";
const OFFICER_CACHE_KEY = "vetkonnect:dvs_officer";

const DEFAULT_SETTINGS: DvsSettings = {
  certificateValidityDays: 365,
  coverageAlertThreshold: 70,
  expiryWarningDays: 30,
  verificationEnabled: true,
};

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return bytesToHex(bits);
}

function randomSaltHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createPasswordHash(password: string): Promise<string> {
  const salt = randomSaltHex();
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = await hashPassword(password, salt);
  return actual === expected;
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return error.code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

function randomVerificationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function hasRabiesTimeline(pet: Pet): boolean {
  const next = (pet.nextVaccine ?? "").toLowerCase();
  if (next.includes("rabies")) return true;
  return (pet.timeline ?? []).some((event) => {
    const blob = `${event.title} ${event.detail}`.toLowerCase();
    return event.type === "vaccine" && blob.includes("rabies");
  });
}

function certificateVerifyUrl(code: string): string {
  if (typeof window === "undefined") return `/certificate/${code}`;
  return `${window.location.origin}/certificate/${code}`;
}

function mapOfficer(row: Record<string, unknown>): DvsOfficer {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    fullName: String(row.full_name ?? ""),
    title: row.title ? String(row.title) : undefined,
    role: (row.role as DvsOfficerRole) || "officer",
    active: Boolean(row.active ?? true),
    createdAt: String(row.created_at ?? ""),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  };
}

function mapBatch(row: Record<string, unknown>): DvsVaccineBatch {
  return {
    id: String(row.id),
    manufacturer: String(row.manufacturer ?? ""),
    batchNumber: String(row.batch_number ?? ""),
    vaccineName: String(row.vaccine_name ?? "Rabies vaccine"),
    vaccineId: row.vaccine_id ? String(row.vaccine_id) : null,
    veterinarianAccountId: row.veterinarian_account_id ? String(row.veterinarian_account_id) : null,
    source: row.source === "vet" ? "vet" : "dvs",
    expiryDate: row.expiry_date ? String(row.expiry_date) : null,
    quantityReceived: Number(row.quantity_received ?? 0),
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapRecognisedVaccine(row: Record<string, unknown>): DvsRecognisedVaccine {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    vaccineType: String(row.vaccine_type ?? "Inactivated injectable"),
    manufacturer: String(row.manufacturer ?? ""),
    species: String(row.species ?? "Dogs, cats"),
    strain: row.strain ? String(row.strain) : undefined,
    registrationNumber: row.registration_number ? String(row.registration_number) : undefined,
    active: row.active !== false,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapVetCaseReport(row: Record<string, unknown>): DvsVetCaseReport {
  return {
    id: String(row.id),
    veterinarianAccountId: String(row.veterinarian_account_id ?? ""),
    veterinarianName: row.veterinarian_name ? String(row.veterinarian_name) : undefined,
    practiceName: row.practice_name ? String(row.practice_name) : undefined,
    petId: row.pet_id ? String(row.pet_id) : null,
    petName: row.pet_name ? String(row.pet_name) : undefined,
    species: row.species ? String(row.species) : undefined,
    caseStatus: (row.case_status as DvsRabiesCaseStatus) || "suspected",
    province: row.province ? String(row.province) : undefined,
    district: row.district ? String(row.district) : undefined,
    locationLabel: row.location_label ? String(row.location_label) : undefined,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    vaccinationStatus: row.vaccination_status ? String(row.vaccination_status) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    rabiesCaseId: row.rabies_case_id ? String(row.rabies_case_id) : null,
    reviewStatus: (row.review_status as DvsVetReportReviewStatus) || "submitted",
    dvsNotes: row.dvs_notes ? String(row.dvs_notes) : undefined,
    reportedAt: String(row.reported_at ?? ""),
  };
}

function mapHealthReport(row: Record<string, unknown>): DvsAnimalHealthReport {
  return {
    id: String(row.id),
    veterinarianAccountId: String(row.veterinarian_account_id ?? ""),
    veterinarianName: row.veterinarian_name ? String(row.veterinarian_name) : undefined,
    practiceName: row.practice_name ? String(row.practice_name) : undefined,
    reportType: (row.report_type as DvsAnimalHealthReport["reportType"]) || "other",
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    province: row.province ? String(row.province) : undefined,
    district: row.district ? String(row.district) : undefined,
    petId: row.pet_id ? String(row.pet_id) : null,
    reviewStatus: (row.review_status as DvsHealthReportReviewStatus) || "submitted",
    dvsNotes: row.dvs_notes ? String(row.dvs_notes) : undefined,
    submittedAt: String(row.submitted_at ?? ""),
    acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : null,
  };
}

function mapVaccination(row: Record<string, unknown>): DvsVaccination {
  return {
    id: String(row.id),
    petId: row.pet_id ? String(row.pet_id) : null,
    ownerAccountId: row.owner_account_id ? String(row.owner_account_id) : null,
    veterinarianAccountId: row.veterinarian_account_id ? String(row.veterinarian_account_id) : null,
    practiceId: row.practice_id ? String(row.practice_id) : null,
    batchId: row.batch_id ? String(row.batch_id) : null,
    vaccineId: row.vaccine_id ? String(row.vaccine_id) : null,
    vaccinatedAt: String(row.vaccinated_at ?? ""),
    validUntil: row.valid_until ? String(row.valid_until) : null,
    province: row.province ? String(row.province) : undefined,
    district: row.district ? String(row.district) : undefined,
    status: (row.status as DvsVaccination["status"]) || "administered",
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapCertificate(row: Record<string, unknown>): DvsCertificate {
  return {
    id: String(row.id),
    certificateNumber: String(row.certificate_number ?? ""),
    verificationCode: String(row.verification_code ?? ""),
    petId: row.pet_id ? String(row.pet_id) : null,
    ownerAccountId: row.owner_account_id ? String(row.owner_account_id) : null,
    vaccinationId: row.vaccination_id ? String(row.vaccination_id) : null,
    veterinarianAccountId: row.veterinarian_account_id ? String(row.veterinarian_account_id) : null,
    practiceId: row.practice_id ? String(row.practice_id) : null,
    issuedByDvsId: row.issued_by_dvs_id ? String(row.issued_by_dvs_id) : null,
    issuedAt: String(row.issued_at ?? ""),
    expiresAt: String(row.expires_at ?? ""),
    status: (row.status as DvsCertificateStatus) || "valid",
    previousCertificateId: row.previous_certificate_id ? String(row.previous_certificate_id) : null,
    petName: row.pet_name ? String(row.pet_name) : undefined,
    species: row.species ? String(row.species) : undefined,
    breed: row.breed ? String(row.breed) : undefined,
    microchip: row.microchip ? String(row.microchip) : undefined,
    vetconnectId: row.vetconnect_id ? String(row.vetconnect_id) : undefined,
    ownerName: row.owner_name ? String(row.owner_name) : undefined,
    ownerPhone: row.owner_phone ? String(row.owner_phone) : undefined,
    veterinarianName: row.veterinarian_name ? String(row.veterinarian_name) : undefined,
    practiceName: row.practice_name ? String(row.practice_name) : undefined,
    manufacturer: row.manufacturer ? String(row.manufacturer) : undefined,
    batchNumber: row.batch_number ? String(row.batch_number) : undefined,
    vaccineName: row.vaccine_name ? String(row.vaccine_name) : undefined,
    vaccineId: row.vaccine_id ? String(row.vaccine_id) : null,
    province: row.province ? String(row.province) : undefined,
    district: row.district ? String(row.district) : undefined,
    qrPayload: row.qr_payload ? String(row.qr_payload) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapScan(row: Record<string, unknown>): DvsQrScan {
  return {
    id: String(row.id),
    certificateId: row.certificate_id ? String(row.certificate_id) : null,
    verificationCode: row.verification_code ? String(row.verification_code) : undefined,
    result: (row.result as DvsQrScanResult) || "invalid",
    scannerContext: row.scanner_context ? String(row.scanner_context) : undefined,
    locationLabel: row.location_label ? String(row.location_label) : undefined,
    scannedAt: String(row.scanned_at ?? ""),
  };
}

function mapRabiesCase(row: Record<string, unknown>): DvsRabiesCase {
  return {
    id: String(row.id),
    status: (row.status as DvsRabiesCaseStatus) || "suspected",
    species: row.species ? String(row.species) : undefined,
    petId: row.pet_id ? String(row.pet_id) : null,
    petName: row.pet_name ? String(row.pet_name) : undefined,
    province: row.province ? String(row.province) : undefined,
    district: row.district ? String(row.district) : undefined,
    locationLabel: row.location_label ? String(row.location_label) : undefined,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    vaccinationStatus: row.vaccination_status ? String(row.vaccination_status) : undefined,
    reportedAt: String(row.reported_at ?? ""),
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function mapAudit(row: Record<string, unknown>): DvsAuditEntry {
  return {
    id: String(row.id),
    actorType: String(row.actor_type ?? "dvs"),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorName: row.actor_name ? String(row.actor_name) : undefined,
    action: String(row.action ?? ""),
    entityType: String(row.entity_type ?? ""),
    entityId: row.entity_id ? String(row.entity_id) : null,
    detail: (row.detail as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? ""),
  };
}

function refreshCertificateStatuses(certificates: DvsCertificate[]): DvsCertificate[] {
  const today = todayIso();
  return certificates.map((cert) => {
    if (cert.status === "cancelled" || cert.status === "amended" || cert.status === "suspicious") return cert;
    const nextStatus: DvsCertificateStatus = cert.expiresAt < today ? "expired" : "valid";
    return nextStatus === cert.status ? cert : { ...cert, status: nextStatus };
  });
}

export function getDvsSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function clearDvsSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(OFFICER_CACHE_KEY);
}

function setDvsSession(officer: DvsOfficer): void {
  localStorage.setItem(SESSION_KEY, officer.id);
  localStorage.setItem(OFFICER_CACHE_KEY, JSON.stringify(officer));
}

export async function getDvsSessionOfficer(): Promise<DvsOfficer | null> {
  const id = getDvsSessionId();
  if (!id) return null;

  try {
    const cached = localStorage.getItem(OFFICER_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as DvsOfficer;
      if (parsed.id === id) return parsed;
    }
  } catch {
    /* ignore */
  }

  const { data, error } = await supabase.from("dvs_accounts").select("*").eq("id", id).maybeSingle();
  if (error || !data) {
    clearDvsSession();
    return null;
  }
  const officer = mapOfficer(data as Record<string, unknown>);
  if (!officer.active) {
    clearDvsSession();
    return null;
  }
  setDvsSession(officer);
  return officer;
}

export async function loginDvsOfficer(email: string, password: string): Promise<DvsOfficer> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) throw new Error("Email and password are required.");

  const { data, error } = await supabase.from("dvs_accounts").select("*").ilike("email", normalized).maybeSingle();
  if (error) {
    if (isMissingRelation(error)) throw new Error("DVS tables are not installed. Apply migration 019_dvs_dashboard.sql in Supabase.");
    throw error;
  }
  if (!data) throw new Error("No DVS account found for that email.");

  const officer = mapOfficer(data as Record<string, unknown>);
  if (!officer.active) throw new Error("This DVS account is inactive. Contact VetKonnect admin.");

  const ok = await verifyPassword(password, String((data as Record<string, unknown>).password_hash ?? ""));
  if (!ok) throw new Error("Incorrect password.");

  await supabase.from("dvs_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", officer.id);
  setDvsSession(officer);
  await writeAudit({
    actorType: "dvs",
    actorId: officer.id,
    actorName: officer.fullName,
    action: "login",
    entityType: "dvs_account",
    entityId: officer.id,
  });
  return officer;
}

export async function listDvsOfficers(): Promise<DvsOfficer[]> {
  const { data, error } = await supabase.from("dvs_accounts").select("*").order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapOfficer(row as Record<string, unknown>));
}

export async function createDvsOfficer(input: {
  email: string;
  password: string;
  fullName: string;
  title?: string;
  role?: DvsOfficerRole;
}): Promise<DvsOfficer> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email || !fullName || !input.password) {
    throw new Error("Full name, email, and password are required.");
  }
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await createPasswordHash(input.password);
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from("dvs_accounts")
    .insert({
      id,
      email,
      password_hash: passwordHash,
      full_name: fullName,
      title: input.title?.trim() || null,
      role: input.role ?? "officer",
      active: true,
    })
    .select("*")
    .single();

  if (error) {
    if (String(error.message).toLowerCase().includes("duplicate") || error.code === "23505") {
      throw new Error("A DVS officer with that email already exists.");
    }
    if (isMissingRelation(error)) throw new Error("Apply migration 019_dvs_dashboard.sql in Supabase first.");
    throw error;
  }
  const officer = mapOfficer(data as Record<string, unknown>);
  await writeAudit({
    actorType: "admin",
    action: "create_officer",
    entityType: "dvs_account",
    entityId: officer.id,
    detail: { email: officer.email, fullName: officer.fullName },
  });
  return officer;
}

export async function setDvsOfficerActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("dvs_accounts").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteDvsOfficer(id: string): Promise<void> {
  const { error } = await supabase.from("dvs_accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function writeAudit(input: {
  actorType?: string;
  actorId?: string | null;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("dvs_audit_log").insert({
    id: crypto.randomUUID(),
    actor_type: input.actorType ?? "dvs",
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    detail: input.detail ?? {},
  });
  if (error && !isMissingRelation(error)) console.warn("DVS audit write failed", error);
}

export async function listDvsCertificates(): Promise<DvsCertificate[]> {
  const { data, error } = await supabase.from("dvs_certificates").select("*").order("issued_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return refreshCertificateStatuses((data ?? []).map((row) => mapCertificate(row as Record<string, unknown>)));
}

export async function listCertificatesForPet(petId: string): Promise<DvsCertificate[]> {
  const { data, error } = await supabase
    .from("dvs_certificates")
    .select("*")
    .eq("pet_id", petId)
    .order("issued_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return refreshCertificateStatuses((data ?? []).map((row) => mapCertificate(row as Record<string, unknown>)));
}

export async function getCertificateByCode(code: string): Promise<DvsCertificate | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const byCode = await supabase.from("dvs_certificates").select("*").eq("verification_code", trimmed).maybeSingle();
  if (byCode.error) {
    if (isMissingRelation(byCode.error)) return null;
    throw byCode.error;
  }
  if (byCode.data) return refreshCertificateStatuses([mapCertificate(byCode.data as Record<string, unknown>)])[0];

  const byNumber = await supabase.from("dvs_certificates").select("*").eq("certificate_number", trimmed).maybeSingle();
  if (byNumber.error) {
    if (isMissingRelation(byNumber.error)) return null;
    throw byNumber.error;
  }
  if (!byNumber.data) return null;
  return refreshCertificateStatuses([mapCertificate(byNumber.data as Record<string, unknown>)])[0];
}

export async function listDvsVaccinations(): Promise<DvsVaccination[]> {
  const { data, error } = await supabase.from("dvs_vaccinations").select("*").order("vaccinated_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapVaccination(row as Record<string, unknown>));
}

export async function listDvsBatches(): Promise<DvsVaccineBatch[]> {
  const { data, error } = await supabase.from("dvs_vaccine_batches").select("*").order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapBatch(row as Record<string, unknown>));
}

export async function listRecognisedVaccines(): Promise<DvsRecognisedVaccine[]> {
  const { data, error } = await supabase.from("dvs_recognised_vaccines").select("*").order("name");
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapRecognisedVaccine(row as Record<string, unknown>));
}

export async function createRecognisedVaccine(input: {
  name: string;
  vaccineType: string;
  manufacturer: string;
  species?: string;
  strain?: string;
  registrationNumber?: string;
  notes?: string;
}): Promise<DvsRecognisedVaccine> {
  const officer = await getDvsSessionOfficer();
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Vaccine name is required.");
  const { data, error } = await supabase
    .from("dvs_recognised_vaccines")
    .insert({
      id: crypto.randomUUID(),
      name,
      vaccine_type: input.vaccineType.trim() || "Inactivated injectable",
      manufacturer: input.manufacturer.trim() || "Unknown",
      species: input.species?.trim() || "Dogs, cats",
      strain: input.strain?.trim() || null,
      registration_number: input.registrationNumber?.trim() || null,
      notes: input.notes?.trim() || null,
      active: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  const vaccine = mapRecognisedVaccine(data as Record<string, unknown>);
  await writeAudit({
    actorType: "dvs",
    actorId: officer?.id,
    actorName: officer?.fullName,
    action: "create_recognised_vaccine",
    entityType: "recognised_vaccine",
    entityId: vaccine.id,
    detail: { name: vaccine.name, manufacturer: vaccine.manufacturer },
  });
  return vaccine;
}

export async function setRecognisedVaccineActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("dvs_recognised_vaccines").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function listVetCaseReports(): Promise<DvsVetCaseReport[]> {
  const { data, error } = await supabase.from("dvs_vet_case_reports").select("*").order("reported_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapVetCaseReport(row as Record<string, unknown>));
}

export async function listAnimalHealthReports(): Promise<DvsAnimalHealthReport[]> {
  const { data, error } = await supabase.from("dvs_animal_health_reports").select("*").order("submitted_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapHealthReport(row as Record<string, unknown>));
}

export async function reviewVetCaseReport(id: string, reviewStatus: DvsVetReportReviewStatus, dvsNotes?: string): Promise<void> {
  const officer = await getDvsSessionOfficer();
  const { error } = await supabase
    .from("dvs_vet_case_reports")
    .update({ review_status: reviewStatus, dvs_notes: dvsNotes?.trim() || null })
    .eq("id", id);
  if (error) throw error;
  await writeAudit({
    actorType: "dvs",
    actorId: officer?.id,
    actorName: officer?.fullName,
    action: `review_case_${reviewStatus}`,
    entityType: "vet_case_report",
    entityId: id,
    detail: { reviewStatus },
  });
}

export async function reviewAnimalHealthReport(
  id: string,
  reviewStatus: DvsHealthReportReviewStatus,
  dvsNotes?: string,
): Promise<void> {
  const officer = await getDvsSessionOfficer();
  const { error } = await supabase
    .from("dvs_animal_health_reports")
    .update({
      review_status: reviewStatus,
      dvs_notes: dvsNotes?.trim() || null,
      acknowledged_at: reviewStatus === "submitted" ? null : new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  await writeAudit({
    actorType: "dvs",
    actorId: officer?.id,
    actorName: officer?.fullName,
    action: `review_health_report_${reviewStatus}`,
    entityType: "animal_health_report",
    entityId: id,
    detail: { reviewStatus },
  });
}

export async function listDvsScans(): Promise<DvsQrScan[]> {
  const { data, error } = await supabase.from("dvs_qr_scans").select("*").order("scanned_at", { ascending: false }).limit(400);
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapScan(row as Record<string, unknown>));
}

export async function listDvsRabiesCases(): Promise<DvsRabiesCase[]> {
  const { data, error } = await supabase.from("dvs_rabies_cases").select("*").order("reported_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapRabiesCase(row as Record<string, unknown>));
}

export async function listDvsAudit(limit = 200): Promise<DvsAuditEntry[]> {
  const { data, error } = await supabase.from("dvs_audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapAudit(row as Record<string, unknown>));
}

export async function getDvsSettings(): Promise<DvsSettings> {
  const { data, error } = await supabase.from("dvs_settings").select("*");
  if (error) {
    if (isMissingRelation(error)) return DEFAULT_SETTINGS;
    throw error;
  }
  const map = new Map((data ?? []).map((row) => [String(row.key), row.value]));
  return {
    certificateValidityDays: Number(map.get("certificate_validity_days") ?? DEFAULT_SETTINGS.certificateValidityDays),
    coverageAlertThreshold: Number(map.get("coverage_alert_threshold") ?? DEFAULT_SETTINGS.coverageAlertThreshold),
    expiryWarningDays: Number(map.get("expiry_warning_days") ?? DEFAULT_SETTINGS.expiryWarningDays),
    verificationEnabled: Boolean(map.get("verification_enabled") ?? DEFAULT_SETTINGS.verificationEnabled),
  };
}

export async function saveDvsSettings(settings: DvsSettings, officer?: DvsOfficer | null): Promise<void> {
  const rows = [
    { key: "certificate_validity_days", value: settings.certificateValidityDays },
    { key: "coverage_alert_threshold", value: settings.coverageAlertThreshold },
    { key: "expiry_warning_days", value: settings.expiryWarningDays },
    { key: "verification_enabled", value: settings.verificationEnabled },
  ].map((row) => ({ ...row, updated_at: new Date().toISOString() }));
  const { error } = await supabase.from("dvs_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
  await writeAudit({
    actorType: "dvs",
    actorId: officer?.id,
    actorName: officer?.fullName,
    action: "update_settings",
    entityType: "dvs_settings",
    detail: settings as unknown as Record<string, unknown>,
  });
}

async function nextCertificateNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { count, error } = await supabase.from("dvs_certificates").select("*", { count: "exact", head: true });
  if (error && !isMissingRelation(error)) throw error;
  return `ZW-DVS-RAB-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

export async function createVaccineBatch(input: {
  manufacturer: string;
  batchNumber: string;
  vaccineName?: string;
  vaccineId?: string;
  expiryDate?: string;
  quantityReceived: number;
  notes?: string;
  veterinarianAccountId?: string;
  source?: "dvs" | "vet";
}): Promise<DvsVaccineBatch> {
  const officer = await getDvsSessionOfficer();
  const { data, error } = await supabase
    .from("dvs_vaccine_batches")
    .insert({
      id: crypto.randomUUID(),
      manufacturer: input.manufacturer.trim(),
      batch_number: input.batchNumber.trim(),
      vaccine_name: input.vaccineName?.trim() || "Rabies vaccine",
      vaccine_id: input.vaccineId || null,
      expiry_date: input.expiryDate || null,
      quantity_received: input.quantityReceived,
      notes: input.notes?.trim() || null,
      veterinarian_account_id: input.veterinarianAccountId || null,
      source: input.source || (input.veterinarianAccountId ? "vet" : "dvs"),
    })
    .select("*")
    .single();
  if (error) throw error;
  const batch = mapBatch(data as Record<string, unknown>);
  await writeAudit({
    actorType: input.source === "vet" ? "vet" : "dvs",
    actorId: input.veterinarianAccountId || officer?.id,
    actorName: officer?.fullName,
    action: "create_batch",
    entityType: "vaccine_batch",
    entityId: batch.id,
    detail: { batchNumber: batch.batchNumber, manufacturer: batch.manufacturer },
  });
  return batch;
}

export async function findOrCreateVaccineBatch(input: {
  manufacturer: string;
  batchNumber: string;
  vaccineName?: string;
  vaccineId?: string;
  expiryDate?: string;
  quantityReceived?: number;
  veterinarianAccountId?: string;
  source?: "dvs" | "vet";
}): Promise<DvsVaccineBatch> {
  const batchNumber = input.batchNumber.trim();
  if (!batchNumber) throw new Error("Batch number is required.");
  const { data: existing, error: lookupError } = await supabase
    .from("dvs_vaccine_batches")
    .select("*")
    .eq("batch_number", batchNumber)
    .maybeSingle();
  if (lookupError && !isMissingRelation(lookupError)) throw lookupError;
  if (existing) return mapBatch(existing as Record<string, unknown>);
  try {
    return await createVaccineBatch({
      manufacturer: input.manufacturer,
      batchNumber,
      vaccineName: input.vaccineName,
      vaccineId: input.vaccineId,
      expiryDate: input.expiryDate,
      quantityReceived: input.quantityReceived ?? 0,
      veterinarianAccountId: input.veterinarianAccountId,
      source: input.source,
    });
  } catch (error) {
    const { data: retry } = await supabase.from("dvs_vaccine_batches").select("*").eq("batch_number", batchNumber).maybeSingle();
    if (retry) return mapBatch(retry as Record<string, unknown>);
    throw error;
  }
}

export async function createRabiesCase(input: {
  status: DvsRabiesCaseStatus;
  species?: string;
  petId?: string;
  petName?: string;
  province?: string;
  district?: string;
  locationLabel?: string;
  vaccinationStatus?: string;
  notes?: string;
  veterinarianAccountId?: string;
  source?: "dvs" | "vet";
}): Promise<DvsRabiesCase> {
  const officer = await getDvsSessionOfficer();
  const place = coordsForRabiesPlace(input.province, input.district, input.locationLabel);
  const region = input.province ? regionForProvince(input.province) : undefined;
  const { data, error } = await supabase
    .from("dvs_rabies_cases")
    .insert({
      id: crypto.randomUUID(),
      status: input.status,
      species: input.species || "Dog",
      pet_id: input.petId || null,
      pet_name: input.petName || null,
      province: input.province || place?.province || null,
      district: input.district || place?.district || null,
      location_label: input.locationLabel || place?.locationLabel || input.district || input.province || null,
      latitude: place?.latitude ?? region?.latitude ?? null,
      longitude: place?.longitude ?? region?.longitude ?? null,
      vaccination_status: input.vaccinationStatus || null,
      notes: input.notes || null,
      veterinarian_account_id: input.veterinarianAccountId || null,
      source: input.source || "dvs",
    })
    .select("*")
    .single();
  if (error) throw error;
  const item = mapRabiesCase(data as Record<string, unknown>);
  await writeAudit({
    actorType: "dvs",
    actorId: officer?.id,
    actorName: officer?.fullName,
    action: "create_rabies_case",
    entityType: "rabies_case",
    entityId: item.id,
    detail: { status: item.status, province: item.province },
  });
  return item;
}

export type IssueCertificateInput = {
  pet: Pet;
  ownerName?: string;
  ownerPhone?: string;
  veterinarianAccountId?: string;
  veterinarianName: string;
  practiceId?: string;
  practiceName: string;
  batch?: DvsVaccineBatch | null;
  vaccine?: DvsRecognisedVaccine | null;
  vaccinatedAt: string;
  province: string;
  district: string;
  notes?: string;
  previousCertificateId?: string;
  notifyOwner?: boolean;
  issuedByVet?: boolean;
};

export async function issueDvsCertificate(input: IssueCertificateInput): Promise<DvsCertificate> {
  const officer = await getDvsSessionOfficer();
  if (!officer && !input.issuedByVet) throw new Error("DVS session required.");
  const settings = await getDvsSettings();
  const vaccinatedAt = input.vaccinatedAt.slice(0, 10);
  const expiresAt = addDays(vaccinatedAt, settings.certificateValidityDays);
  const verificationCode = randomVerificationCode();
  const certificateNumber = await nextCertificateNumber();
  const qrPayload = certificateVerifyUrl(verificationCode);
  const vaccineName = input.vaccine?.name || input.batch?.vaccineName || "Rabies vaccine";
  const manufacturer = input.vaccine?.manufacturer || input.batch?.manufacturer || null;
  const vaccineId = input.vaccine?.id || input.batch?.vaccineId || null;

  const vaccinationId = crypto.randomUUID();
  const { error: vaxError } = await supabase.from("dvs_vaccinations").insert({
    id: vaccinationId,
    pet_id: input.pet.id,
    owner_account_id: input.pet.ownerId ?? null,
    veterinarian_account_id: input.veterinarianAccountId || null,
    practice_id: input.practiceId || null,
    batch_id: input.batch?.id || null,
    vaccine_id: vaccineId,
    vaccinated_at: vaccinatedAt,
    valid_until: expiresAt,
    province: input.province,
    district: input.district,
    status: "administered",
    notes: input.notes || null,
  });
  if (vaxError) throw vaxError;

  if (input.previousCertificateId) {
    await supabase
      .from("dvs_certificates")
      .update({ status: "amended" })
      .eq("id", input.previousCertificateId);
  }

  const certId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("dvs_certificates")
    .insert({
      id: certId,
      certificate_number: certificateNumber,
      verification_code: verificationCode,
      pet_id: input.pet.id,
      owner_account_id: input.pet.ownerId ?? null,
      vaccination_id: vaccinationId,
      veterinarian_account_id: input.veterinarianAccountId || null,
      practice_id: input.practiceId || null,
      issued_by_dvs_id: officer?.id || null,
      issued_at: vaccinatedAt,
      expires_at: expiresAt,
      status: "valid",
      previous_certificate_id: input.previousCertificateId || null,
      pet_name: input.pet.name,
      species: input.pet.species,
      breed: input.pet.breed,
      microchip: input.pet.microchip || null,
      vetconnect_id: input.pet.vetConnectId,
      owner_name: input.ownerName || null,
      owner_phone: input.ownerPhone || null,
      veterinarian_name: input.veterinarianName,
      practice_name: input.practiceName,
      manufacturer,
      batch_number: input.batch?.batchNumber || null,
      vaccine_name: vaccineName,
      vaccine_id: vaccineId,
      province: input.province,
      district: input.district,
      qr_payload: qrPayload,
      notes: input.notes || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  const certificate = mapCertificate(data as Record<string, unknown>);
  await writeAudit({
    actorType: input.issuedByVet ? "vet" : "dvs",
    actorId: officer?.id || input.veterinarianAccountId,
    actorName: officer?.fullName || input.veterinarianName,
    action: input.previousCertificateId ? "amend_certificate" : "issue_certificate",
    entityType: "certificate",
    entityId: certificate.id,
    detail: {
      certificateNumber: certificate.certificateNumber,
      petId: input.pet.id,
      petName: input.pet.name,
      microchip: input.pet.microchip,
      vaccineName,
      batchNumber: input.batch?.batchNumber,
    },
  });

  if (input.notifyOwner !== false && input.pet.ownerId) {
    await notifyAccount({
      accountId: input.pet.ownerId,
      type: "dvs",
      title: input.issuedByVet ? "Rabies certificate issued by your veterinarian" : "Official rabies certificate issued",
      body: input.issuedByVet
        ? `${input.pet.name} now has rabies certificate ${certificate.certificateNumber} (${vaccineName}). Open the pet passport to view or download it.`
        : `${input.pet.name} now has DVS certificate ${certificate.certificateNumber}. Open the pet passport to view or download it.`,
    });
  }

  return certificate;
}

export async function updateCertificateStatus(
  id: string,
  status: DvsCertificateStatus,
  notes?: string,
): Promise<void> {
  const officer = await getDvsSessionOfficer();
  const { data, error } = await supabase
    .from("dvs_certificates")
    .update({ status, notes: notes || null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  const cert = mapCertificate(data as Record<string, unknown>);
  await writeAudit({
    actorType: "dvs",
    actorId: officer?.id,
    actorName: officer?.fullName,
    action: `set_status_${status}`,
    entityType: "certificate",
    entityId: id,
    detail: { certificateNumber: cert.certificateNumber, status },
  });
  if (cert.ownerAccountId && (status === "cancelled" || status === "suspicious")) {
    await notifyAccount({
      accountId: cert.ownerAccountId,
      type: "dvs",
      title: status === "cancelled" ? "Certificate cancelled" : "Certificate flagged",
      body: `DVS updated certificate ${cert.certificateNumber} for ${cert.petName ?? "your animal"} to ${status}.`,
    });
  }
}

export async function notifyOwnerOfCertificate(certificate: DvsCertificate): Promise<void> {
  if (!certificate.ownerAccountId) throw new Error("This certificate is not linked to an owner account.");
  await notifyAccount({
    accountId: certificate.ownerAccountId,
    type: "dvs",
    title: "Your DVS rabies certificate",
    body: `Certificate ${certificate.certificateNumber} for ${certificate.petName ?? "your animal"} is available in the VetKonnect pet passport.`,
  });
  const officer = await getDvsSessionOfficer();
  await writeAudit({
    actorType: "dvs",
    actorId: officer?.id,
    actorName: officer?.fullName,
    action: "send_certificate_to_owner",
    entityType: "certificate",
    entityId: certificate.id,
    detail: { certificateNumber: certificate.certificateNumber },
  });
}

export async function logCertificateVerification(input: {
  code: string;
  scannerContext?: string;
  locationLabel?: string;
}): Promise<{ certificate: DvsCertificate | null; result: DvsQrScanResult }> {
  const certificate = await getCertificateByCode(input.code);
  const result: DvsQrScanResult = certificate ? certificate.status : "not_found";
  await supabase.from("dvs_qr_scans").insert({
    id: crypto.randomUUID(),
    certificate_id: certificate?.id ?? null,
    verification_code: input.code.trim().toUpperCase(),
    result,
    scanner_context: input.scannerContext || "public_verify",
    location_label: input.locationLabel || null,
  });
  await writeAudit({
    actorType: "system",
    action: "verify_certificate",
    entityType: "certificate",
    entityId: certificate?.id ?? null,
    detail: { code: input.code.trim().toUpperCase(), result },
  });
  return { certificate, result };
}

export async function searchDvsAnimals(query: string): Promise<Pet[]> {
  const q = query.trim().replace(/[,()]/g, " ");
  if (!q) return [];
  const like = `%${q}%`;
  const { data, error } = await supabase
    .from("pets")
    .select("*")
    .or(`name.ilike.${like},vetconnect_id.ilike.${like},collar_id.ilike.${like},microchip.ilike.${like}`)
    .limit(25);
  if (error) throw error;
  return (data ?? []).map((row) => ({
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
  }));
}

export async function lookupOwner(accountId: string): Promise<{ fullName: string; phone: string } | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select("full_name, phone")
    .eq("id", accountId)
    .maybeSingle();
  if (error || !data) return null;
  return { fullName: String(data.full_name ?? "Unknown owner"), phone: String(data.phone ?? "") };
}

function buildCoverage(
  pets: Pet[],
  certificates: DvsCertificate[],
  vaccinations: DvsVaccination[],
): DvsCoverageRow[] {
  const petRegion = new Map<string, { province: string; district: string }>();
  for (const cert of certificates) {
    if (cert.petId && cert.province) {
      petRegion.set(cert.petId, { province: cert.province, district: cert.district || "" });
    }
  }
  for (const vax of vaccinations) {
    if (vax.petId && vax.province && !petRegion.has(vax.petId)) {
      petRegion.set(vax.petId, { province: vax.province, district: vax.district || "" });
    }
  }

  const vaccinatedPetIds = new Set(
    vaccinations.filter((v) => v.status === "administered" && v.petId).map((v) => v.petId as string),
  );
  const identifiedPetIds = new Set(pets.filter((p) => Boolean(p.microchip || p.collarId || p.vetConnectId)).map((p) => p.id));

  const rows: DvsCoverageRow[] = DVS_REGIONS.map((region) => {
    const animals = pets.filter((pet) => (petRegion.get(pet.id)?.province ?? assignRegionFromSeed(pet.id).province) === region.province);
    const vaccinated = animals.filter((pet) => vaccinatedPetIds.has(pet.id) || hasRabiesTimeline(pet)).length;
    const identified = animals.filter((pet) => identifiedPetIds.has(pet.id)).length;
    const coveragePct = animals.length === 0 ? 0 : Math.round((vaccinated / animals.length) * 100);
    return {
      province: region.province,
      animals: animals.length,
      vaccinated,
      identified,
      coveragePct,
    };
  });
  return rows;
}

function buildAlerts(input: {
  certificates: DvsCertificate[];
  pets: Pet[];
  coverage: DvsCoverageRow[];
  batches: DvsVaccineBatch[];
  settings: DvsSettings;
  vetCaseReports: DvsVetCaseReport[];
  healthReports: DvsAnimalHealthReport[];
}): DvsAlert[] {
  const today = todayIso();
  const warnBy = addDays(today, input.settings.expiryWarningDays);
  const invalid = input.certificates.filter((c) => c.status === "cancelled" || c.status === "suspicious");
  const expiring = input.certificates.filter((c) => c.status === "valid" && c.expiresAt >= today && c.expiresAt <= warnBy);
  const expired = input.certificates.filter((c) => c.status === "expired" || (c.status === "valid" && c.expiresAt < today));
  const lowCoverage = input.coverage.filter((row) => row.animals > 0 && row.coveragePct < input.settings.coverageAlertThreshold);

  const validByPet = new Map<string, DvsCertificate[]>();
  for (const cert of input.certificates.filter((c) => c.status === "valid" && c.petId)) {
    const list = validByPet.get(cert.petId as string) ?? [];
    list.push(cert);
    validByPet.set(cert.petId as string, list);
  }
  const duplicates = [...validByPet.values()].filter((list) => list.length > 1);

  const chipCounts = new Map<string, string[]>();
  for (const pet of input.pets) {
    const chip = pet.microchip?.trim();
    if (!chip) continue;
    const list = chipCounts.get(chip) ?? [];
    list.push(pet.id);
    chipCounts.set(chip, list);
  }
  const duplicateChips = [...chipCounts.values()].filter((list) => list.length > 1);
  const expiredBatches = input.batches.filter((b) => b.expiryDate && b.expiryDate < today);

  const alerts: DvsAlert[] = [];
  if (invalid.length) {
    alerts.push({
      id: "invalid",
      severity: "red",
      title: "Invalid certificates",
      detail: "Cancelled or flagged suspicious certificates requiring DVS review.",
      count: invalid.length,
    });
  }
  if (duplicates.length || duplicateChips.length) {
    alerts.push({
      id: "duplicates",
      severity: "red",
      title: "Suspicious / duplicate records",
      detail: `${duplicates.length} animals with more than one valid certificate; ${duplicateChips.length} duplicate microchips.`,
      count: duplicates.length + duplicateChips.length,
    });
  }
  if (lowCoverage.length) {
    alerts.push({
      id: "coverage",
      severity: "orange",
      title: "Low vaccination coverage areas",
      detail: lowCoverage.map((row) => `${row.province} ${row.coveragePct}%`).join(" · "),
      count: lowCoverage.length,
    });
  }
  if (expiring.length) {
    alerts.push({
      id: "expiring",
      severity: "yellow",
      title: "Expiring certificates",
      detail: `Valid certificates due within ${input.settings.expiryWarningDays} days.`,
      count: expiring.length,
    });
  }
  if (expired.length) {
    alerts.push({
      id: "expired",
      severity: "orange",
      title: "Expired vaccinations",
      detail: "Certificates past their validity date.",
      count: expired.length,
    });
  }
  if (expiredBatches.length) {
    alerts.push({
      id: "batches",
      severity: "orange",
      title: "Expired vaccine batches",
      detail: expiredBatches.map((b) => b.batchNumber).join(", "),
      count: expiredBatches.length,
    });
  }
  const pendingCases = input.vetCaseReports.filter((item) => item.reviewStatus === "submitted");
  const pendingHealth = input.healthReports.filter((item) => item.reviewStatus === "submitted");
  if (pendingCases.length) {
    alerts.push({
      id: "vet-cases",
      severity: "red",
      title: "Vet-reported rabies cases",
      detail: "New case reports from veterinary practices awaiting DVS review.",
      count: pendingCases.length,
    });
  }
  if (pendingHealth.length) {
    alerts.push({
      id: "vet-reports",
      severity: "orange",
      title: "Animal health reports from vets",
      detail: "Practice reports submitted to DVS and not yet acknowledged.",
      count: pendingHealth.length,
    });
  }
  return alerts;
}

export async function getDvsDashboardSnapshot(): Promise<DvsDashboardSnapshot> {
  const [pets, certificatesRaw, vaccinations, batches, scans, rabiesCases, audit, officers, settings, vetAccounts, practices, recognisedVaccines, vetCaseReports, healthReports, licences, licencePayments] =
    await Promise.all([
      getAllPets(),
      listDvsCertificates(),
      listDvsVaccinations(),
      listDvsBatches(),
      listDvsScans(),
      listDvsRabiesCases(),
      listDvsAudit(),
      listDvsOfficers(),
      getDvsSettings(),
      supabase.from("accounts").select("id, full_name, phone, account_type, vet_verified, practice_name, surgery_id").eq("account_type", "vet"),
      supabase.from("vets").select("id, name, surgery, location, phone, status"),
      listRecognisedVaccines(),
      listVetCaseReports(),
      listAnimalHealthReports(),
      listDvsAnimalLicences(),
      listDvsLicencePayments(),
    ]);

  const certificates = refreshCertificateStatuses(certificatesRaw);
  const coverage = buildCoverage(pets, certificates, vaccinations);
  const alerts = buildAlerts({ certificates, pets, coverage, batches, settings, vetCaseReports, healthReports });
  const licenceFinance = buildLicenceFinance(pets, licences, licencePayments);
  const animalRegistry = await buildAnimalRegistry(pets, licences);
  if (licenceFinance.unlicensedAnimals) {
    alerts.push({
      id: "unlicensed",
      severity: "orange",
      title: "Unlicensed animals",
      detail: "Companion animals on VetKonnect without a current DVS annual licence.",
      count: licenceFinance.unlicensedAnimals,
    });
  }

  const vaccinatedPetIds = new Set(
    vaccinations.filter((v) => v.status === "administered" && v.petId).map((v) => v.petId as string),
  );
  const rabiesFromTimeline = pets.filter((p) => hasRabiesTimeline(p)).length;
  const rabiesVaccinations = Math.max(vaccinatedPetIds.size, rabiesFromTimeline, vaccinations.filter((v) => v.status === "administered").length);
  const animalsIdentified = pets.filter((p) => Boolean(p.microchip || p.collarId || p.vetConnectId)).length;
  const activeCertificates = certificates.filter((c) => c.status === "valid").length;
  const expiredCertificates = certificates.filter((c) => c.status === "expired").length;
  const cancelledCertificates = certificates.filter((c) => c.status === "cancelled" || c.status === "suspicious").length;
  const practiceRows = (practices.data ?? []) as Array<Record<string, unknown>>;
  const vetRows = (vetAccounts.data ?? []) as Array<Record<string, unknown>>;
  const activePractices = practiceRows.filter((row) => String(row.status ?? "Active") === "Active").length || practiceRows.length;
  const authorisedVeterinarians = vetRows.filter((row) => Boolean(row.vet_verified)).length || vetRows.length;
  const nationalCoveragePct =
    pets.length === 0 ? 0 : Math.round((pets.filter((p) => vaccinatedPetIds.has(p.id) || hasRabiesTimeline(p)).length / pets.length) * 100);

  const today = todayIso();
  const scansToday = scans.filter((s) => s.scannedAt.slice(0, 10) === today).length;

  const certsByVet = new Map<string, number>();
  const vaxByVet = new Map<string, number>();
  for (const cert of certificates) {
    const key = cert.veterinarianAccountId || cert.veterinarianName || "";
    if (!key) continue;
    certsByVet.set(key, (certsByVet.get(key) ?? 0) + 1);
  }
  for (const vax of vaccinations) {
    const key = vax.veterinarianAccountId || "";
    if (!key) continue;
    vaxByVet.set(key, (vaxByVet.get(key) ?? 0) + 1);
  }

  const practitioners: DvsPractitionerRow[] = [
    ...vetRows.map((row) => {
      const id = String(row.id);
      return {
        id,
        name: String(row.full_name || "Veterinarian"),
        practiceName: String(row.practice_name || "Independent"),
        phone: row.phone ? String(row.phone) : undefined,
        verified: Boolean(row.vet_verified),
        certificatesIssued: certsByVet.get(id) ?? 0,
        vaccinationsRecorded: vaxByVet.get(id) ?? 0,
      };
    }),
    ...practiceRows.map((row) => ({
      id: `practice-${row.id}`,
      name: String(row.name || row.surgery || "Practice"),
      practiceName: String(row.surgery || row.name || ""),
      phone: row.phone ? String(row.phone) : undefined,
      verified: String(row.status ?? "Active") === "Active",
      status: String(row.status ?? "Active"),
      certificatesIssued: certificates.filter((c) => c.practiceId === String(row.id) || c.practiceName === String(row.surgery)).length,
      vaccinationsRecorded: vaccinations.filter((v) => v.practiceId === String(row.id)).length,
    })),
  ];

  const mapPoints: DvsMapPoint[] = [];
  for (const row of coverage) {
    const region = regionForProvince(row.province);
    if (!region) continue;
    mapPoints.push({
      id: `cov-${row.province}`,
      label: row.province,
      kind: "coverage",
      latitude: region.latitude,
      longitude: region.longitude,
      detail: `${row.coveragePct}% coverage · ${row.vaccinated}/${row.animals} vaccinated · ${row.identified} identified`,
    });
  }
  for (const item of rabiesCases) {
    if (item.latitude == null || item.longitude == null) continue;
    mapPoints.push({
      id: item.id,
      label: item.petName || `${item.species ?? "Animal"} rabies ${item.status}`,
      kind: "rabies",
      latitude: item.latitude,
      longitude: item.longitude,
      detail: `${item.status} · ${item.province ?? ""} ${item.district ?? ""}`.trim(),
    });
  }

  const stats: DvsDashboardStats = {
    animalsIdentified,
    rabiesVaccinations,
    activeCertificates,
    expiredCertificates,
    cancelledCertificates,
    activePractices,
    authorisedVeterinarians,
    nationalCoveragePct,
    microchippedAnimals: pets.filter((p) => Boolean(p.microchip)).length,
    scansToday,
    suspectedRabies: rabiesCases.filter((c) => c.status === "suspected").length,
    confirmedRabies: rabiesCases.filter((c) => c.status === "confirmed").length,
    totalAnimals: pets.length,
    licensedAnimals: licenceFinance.activeLicences,
    unlicensedAnimals: licenceFinance.unlicensedAnimals,
    licenceRevenuePaid: licenceFinance.paidAmount,
  };

  return {
    stats,
    certificates,
    vaccinations,
    batches,
    scans,
    rabiesCases,
    audit,
    officers,
    coverage,
    alerts,
    mapPoints,
    practitioners,
    settings,
    pets,
    recognisedVaccines,
    vetCaseReports,
    healthReports,
    licences,
    licencePayments,
    animalRegistry,
    licenceFinance,
  };
}

/** Seeds DVS vaccinations, certificates, batches and cases from the live pet registry when empty. */
export async function syncDvsRegistryFromPets(): Promise<{
  batches: number;
  vaccinations: number;
  certificates: number;
  cases: number;
}> {
  const officer = await getDvsSessionOfficer();
  const pets = await getAllPets();
  const existingCerts = await listDvsCertificates();
  const existingBatches = await listDvsBatches();
  const existingCases = await listDvsRabiesCases();
  const settings = await getDvsSettings();

  const { data: ownerRows } = await supabase.from("accounts").select("id, full_name, phone");
  const owners = new Map(
    (ownerRows ?? []).map((row) => [
      String(row.id),
      { fullName: String(row.full_name ?? "Owner"), phone: String(row.phone ?? "") },
    ]),
  );
  const { data: vetRows } = await supabase.from("accounts").select("id, full_name, practice_name").eq("account_type", "vet");
  const vets = (vetRows ?? []) as Array<Record<string, unknown>>;
  const { data: practiceRows } = await supabase.from("vets").select("id, name, surgery");
  const practices = (practiceRows ?? []) as Array<Record<string, unknown>>;

  let batchesCreated = 0;
  let batchRecords: DvsVaccineBatch[] = existingBatches;
  if (existingBatches.length === 0) {
    const sample = [
      { manufacturer: "Onderstepoort Biological Products", batch_number: "OBP-RAB-24081", quantity_received: 5000, expiry_date: addDays(todayIso(), 420) },
      { manufacturer: "Boehringer Ingelheim", batch_number: "BI-RAB-11882", quantity_received: 2500, expiry_date: addDays(todayIso(), 280) },
      { manufacturer: "MSD Animal Health", batch_number: "MSD-RAB-55210", quantity_received: 1800, expiry_date: addDays(todayIso(), -20) },
    ];
    const rows = sample.map((item) => ({
      id: crypto.randomUUID(),
      ...item,
      vaccine_name: "Rabies vaccine",
      notes: "Synced for DVS national registry",
    }));
    const { error } = await supabase.from("dvs_vaccine_batches").insert(rows);
    if (error) throw error;
    batchesCreated = rows.length;
    batchRecords = await listDvsBatches();
  }

  let vaccinationsCreated = 0;
  let certificatesCreated = 0;
  if (existingCerts.length === 0 && pets.length > 0) {
    const certRows: Record<string, unknown>[] = [];
    const vaxRows: Record<string, unknown>[] = [];
    for (const [index, pet] of pets.entries()) {
      const region = assignRegionFromSeed(pet.id);
      const batch = batchRecords[index % Math.max(batchRecords.length, 1)];
      const vet = vets[index % Math.max(vets.length, 1)];
      const practice = practices[index % Math.max(practices.length, 1)];
      const issued = new Date();
      issued.setMonth(issued.getMonth() - (index % 14));
      const issuedAt = issued.toISOString().slice(0, 10);
      const expiresAt = addDays(issuedAt, settings.certificateValidityDays);
      const expired = expiresAt < todayIso();
      let status: DvsCertificateStatus = expired ? "expired" : "valid";
      if (index % 17 === 0) status = "cancelled";
      if (index % 23 === 0) status = "suspicious";
      const owner = pet.ownerId ? owners.get(pet.ownerId) : undefined;
      const verificationCode = randomVerificationCode();
      const vaccinationId = crypto.randomUUID();
      const certId = crypto.randomUUID();
      vaxRows.push({
        id: vaccinationId,
        pet_id: pet.id,
        owner_account_id: pet.ownerId ?? null,
        veterinarian_account_id: vet ? String(vet.id) : null,
        practice_id: practice ? String(practice.id) : null,
        batch_id: batch?.id ?? null,
        vaccinated_at: issuedAt,
        valid_until: expiresAt,
        province: region.province,
        district: region.district,
        status: status === "cancelled" ? "void" : "administered",
        notes: hasRabiesTimeline(pet) ? "Imported from pet health timeline" : "Synced from VetKonnect registry",
      });
      certRows.push({
        id: certId,
        certificate_number: `ZW-DVS-RAB-${new Date().getFullYear()}-${String(index + 1).padStart(6, "0")}`,
        verification_code: verificationCode,
        pet_id: pet.id,
        owner_account_id: pet.ownerId ?? null,
        vaccination_id: vaccinationId,
        veterinarian_account_id: vet ? String(vet.id) : null,
        practice_id: practice ? String(practice.id) : null,
        issued_by_dvs_id: officer?.id ?? null,
        issued_at: issuedAt,
        expires_at: expiresAt,
        status,
        pet_name: pet.name,
        species: pet.species,
        breed: pet.breed,
        microchip: pet.microchip || null,
        vetconnect_id: pet.vetConnectId,
        owner_name: owner?.fullName ?? null,
        owner_phone: owner?.phone ?? null,
        veterinarian_name: vet ? String(vet.full_name || "Authorised veterinarian") : "Authorised veterinarian",
        practice_name: practice ? String(practice.surgery || practice.name || "Veterinary practice") : "Veterinary practice",
        manufacturer: batch?.manufacturer ?? null,
        batch_number: batch?.batchNumber ?? null,
        vaccine_name: batch?.vaccineName ?? "Rabies vaccine",
        province: region.province,
        district: region.district,
        qr_payload: certificateVerifyUrl(verificationCode),
        notes: "National registry sync",
      });
    }
    const vaxInsert = await supabase.from("dvs_vaccinations").insert(vaxRows);
    if (vaxInsert.error) throw vaxInsert.error;
    const certInsert = await supabase.from("dvs_certificates").insert(certRows);
    if (certInsert.error) throw certInsert.error;
    vaccinationsCreated = vaxRows.length;
    certificatesCreated = certRows.length;
  }

  let casesCreated = 0;
  if (existingCases.length === 0) {
    casesCreated = await insertRabiesDemoRows();
  }

  await writeAudit({
    actorType: "dvs",
    actorId: officer?.id,
    actorName: officer?.fullName,
    action: "sync_registry",
    entityType: "system",
    detail: { batchesCreated, vaccinationsCreated, certificatesCreated, casesCreated },
  });

  return { batches: batchesCreated, vaccinations: vaccinationsCreated, certificates: certificatesCreated, cases: casesCreated };
}

function rabiesDemoRows() {
  return DVS_RABIES_DEMO_CASES.map((sample) => {
    const reported = new Date();
    reported.setDate(reported.getDate() - sample.daysAgo);
    return {
      id: crypto.randomUUID(),
      status: sample.status,
      species: sample.species,
      pet_name: sample.petName,
      province: sample.province,
      district: sample.district,
      location_label: sample.locationLabel,
      latitude: sample.latitude,
      longitude: sample.longitude,
      vaccination_status: sample.vaccinationStatus,
      reported_at: reported.toISOString(),
      notes: `${sample.notes} [DVS demo]`,
    };
  });
}

async function insertRabiesDemoRows(): Promise<number> {
  const rows = rabiesDemoRows();
  const { error } = await supabase.from("dvs_rabies_cases").insert(rows);
  if (error) throw error;
  return rows.length;
}

/** Replaces previous demo surveillance rows with genuine Zimbabwe locations. */
export async function seedDvsRabiesDemoCases(): Promise<number> {
  const officer = await getDvsSessionOfficer();
  await supabase.from("dvs_rabies_cases").delete().ilike("notes", "%[DVS demo]%");
  await supabase.from("dvs_rabies_cases").delete().ilike("notes", "%surveillance sample%");
  const created = await insertRabiesDemoRows();
  await writeAudit({
    actorType: "dvs",
    actorId: officer?.id,
    actorName: officer?.fullName,
    action: "seed_rabies_demo",
    entityType: "rabies_case",
    detail: { created },
  });
  return created;
}
