import { addLicenceDays, dvsLicenceFeeForSpecies, DVS_LICENCE_FEES } from "@/lib/dvsLicenceFees";
import { getPetRecordById } from "@/services/petService";
import { notifyAccount } from "@/services/notificationService";
import { supabase } from "@/services/supabaseClient";
import { getSessionAccountId } from "@/services/userService";
import type {
  DvsAnimalLicence,
  DvsAnimalRegistryRow,
  DvsLicenceFinance,
  DvsLicencePayment,
  DvsLicenceStatus,
  DvsPaymentMethod,
  DvsPaymentStatus,
  Pet,
} from "@/types";

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return error.code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapLicence(row: Record<string, unknown>): DvsAnimalLicence {
  const status = (row.status as DvsLicenceStatus) || "active";
  const expiresAt = String(row.expires_at ?? "");
  const liveStatus: DvsLicenceStatus =
    status === "revoked" || status === "pending" ? status : expiresAt && expiresAt < todayIso() ? "expired" : status;
  return {
    id: String(row.id),
    licenceNumber: String(row.licence_number ?? ""),
    petId: row.pet_id ? String(row.pet_id) : null,
    ownerAccountId: row.owner_account_id ? String(row.owner_account_id) : null,
    ownerName: row.owner_name ? String(row.owner_name) : undefined,
    ownerPhone: row.owner_phone ? String(row.owner_phone) : undefined,
    petName: row.pet_name ? String(row.pet_name) : undefined,
    species: row.species ? String(row.species) : undefined,
    sex: row.sex ? String(row.sex) : undefined,
    issuedAt: String(row.issued_at ?? ""),
    expiresAt,
    status: liveStatus,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? DVS_LICENCE_FEES.currency),
    paymentId: row.payment_id ? String(row.payment_id) : null,
    issuedBy: row.issued_by ? String(row.issued_by) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    proofUrl: row.proof_url ? String(row.proof_url) : undefined,
    createdAt: String(row.created_at ?? ""),
  };
}

function mapPayment(row: Record<string, unknown>): DvsLicencePayment {
  return {
    id: String(row.id),
    reference: String(row.reference ?? ""),
    petId: row.pet_id ? String(row.pet_id) : null,
    ownerAccountId: row.owner_account_id ? String(row.owner_account_id) : null,
    licenceId: row.licence_id ? String(row.licence_id) : null,
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? DVS_LICENCE_FEES.currency),
    method: (row.method as DvsPaymentMethod) || "paynow",
    status: (row.status as DvsPaymentStatus) || "pending",
    phone: row.phone ? String(row.phone) : undefined,
    pollUrl: row.poll_url ? String(row.poll_url) : undefined,
    redirectUrl: row.redirect_url ? String(row.redirect_url) : undefined,
    instructions: row.instructions ? String(row.instructions) : undefined,
    paynowStatus: row.paynow_status ? String(row.paynow_status) : undefined,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listDvsAnimalLicences(): Promise<DvsAnimalLicence[]> {
  const { data, error } = await supabase.from("dvs_animal_licences").select("*").order("issued_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapLicence(row as Record<string, unknown>));
}

export async function listDvsLicencePayments(): Promise<DvsLicencePayment[]> {
  const { data, error } = await supabase.from("dvs_licence_payments").select("*").order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapPayment(row as Record<string, unknown>));
}

export async function listLicencesForPet(petId: string): Promise<DvsAnimalLicence[]> {
  const { data, error } = await supabase
    .from("dvs_animal_licences")
    .select("*")
    .eq("pet_id", petId)
    .order("expires_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapLicence(row as Record<string, unknown>));
}

export async function listPendingPaymentsForPet(petId: string): Promise<DvsLicencePayment[]> {
  const { data, error } = await supabase
    .from("dvs_licence_payments")
    .select("*")
    .eq("pet_id", petId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapPayment(row as Record<string, unknown>));
}

export function currentLicenceForPet(licences: DvsAnimalLicence[], petId: string): DvsAnimalLicence | null {
  const rows = licences.filter((item) => item.petId === petId);
  return rows.find((item) => item.status === "pending") ?? rows.find((item) => item.status === "active") ?? rows[0] ?? null;
}

async function nextLicenceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const { count, error } = await supabase.from("dvs_animal_licences").select("*", { count: "exact", head: true });
  if (error && !isMissingRelation(error)) throw error;
  return `ZW-COUNCIL-REG-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

export async function createLicencePaymentRecord(input: {
  pet: Pet;
  ownerAccountId?: string;
  amount: number;
  method: DvsPaymentMethod;
  phone?: string;
  pollUrl?: string;
  redirectUrl?: string;
  instructions?: string;
}): Promise<DvsLicencePayment> {
  const id = crypto.randomUUID();
  const reference = `COUNCIL-REG-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabase
    .from("dvs_licence_payments")
    .insert({
      id,
      reference,
      pet_id: input.pet.id,
      owner_account_id: input.ownerAccountId || input.pet.ownerId || null,
      amount: input.amount,
      currency: DVS_LICENCE_FEES.currency,
      method: input.method,
      status: "pending",
      phone: input.phone || null,
      poll_url: input.pollUrl || null,
      redirect_url: input.redirectUrl || null,
      instructions: input.instructions || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapPayment(data as Record<string, unknown>);
}

export async function updateLicencePayment(
  id: string,
  patch: Partial<{
    status: DvsPaymentStatus;
    pollUrl: string;
    redirectUrl: string;
    instructions: string;
    paynowStatus: string;
    licenceId: string;
    paidAt: string | null;
  }>,
): Promise<DvsLicencePayment | null> {
  const payload: Record<string, unknown> = {};
  if (patch.status) payload.status = patch.status;
  if (patch.pollUrl !== undefined) payload.poll_url = patch.pollUrl;
  if (patch.redirectUrl !== undefined) payload.redirect_url = patch.redirectUrl;
  if (patch.instructions !== undefined) payload.instructions = patch.instructions;
  if (patch.paynowStatus !== undefined) payload.paynow_status = patch.paynowStatus;
  if (patch.licenceId !== undefined) payload.licence_id = patch.licenceId;
  if (patch.paidAt !== undefined) payload.paid_at = patch.paidAt;
  const { data, error } = await supabase.from("dvs_licence_payments").update(payload).eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  return data ? mapPayment(data as Record<string, unknown>) : null;
}

export async function getLicencePaymentById(id: string): Promise<DvsLicencePayment | null> {
  const { data, error } = await supabase.from("dvs_licence_payments").select("*").eq("id", id).maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data ? mapPayment(data as Record<string, unknown>) : null;
}

export async function getLicencePaymentByReference(reference: string): Promise<DvsLicencePayment | null> {
  const { data, error } = await supabase.from("dvs_licence_payments").select("*").eq("reference", reference).maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data ? mapPayment(data as Record<string, unknown>) : null;
}

export async function issueDvsAnimalLicence(input: {
  pet: Pet;
  amount?: number;
  paymentId?: string;
  method?: DvsPaymentMethod;
  issuedBy?: string;
  notes?: string;
}): Promise<DvsAnimalLicence> {
  let ownerName: string | undefined;
  let ownerPhone: string | undefined;
  if (input.pet.ownerId) {
    const { data } = await supabase.from("accounts").select("full_name, phone").eq("id", input.pet.ownerId).maybeSingle();
    ownerName = data?.full_name ? String(data.full_name) : undefined;
    ownerPhone = data?.phone ? String(data.phone) : undefined;
  }
  const issuedAt = todayIso();
  const amount = input.amount ?? dvsLicenceFeeForSpecies(input.pet.species);
  const licenceNumber = await nextLicenceNumber();
  const existing = await listLicencesForPet(input.pet.id);
  const replaced = existing.filter((item) => item.status === "active" || item.status === "pending");
  if (replaced.length) {
    await supabase.from("dvs_animal_licences").update({ status: "expired" }).in(
      "id",
      replaced.map((item) => item.id),
    );
  }
  const { data, error } = await supabase
    .from("dvs_animal_licences")
    .insert({
      id: crypto.randomUUID(),
      licence_number: licenceNumber,
      pet_id: input.pet.id,
      owner_account_id: input.pet.ownerId || null,
      owner_name: ownerName || null,
      owner_phone: ownerPhone || null,
      pet_name: input.pet.name,
      species: input.pet.species,
      sex: input.pet.sex,
      issued_at: issuedAt,
      expires_at: addLicenceDays(issuedAt),
      status: "active",
      amount,
      currency: DVS_LICENCE_FEES.currency,
      payment_id: input.paymentId || null,
      issued_by: input.issuedBy || input.method || "paynow",
      notes: input.notes || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  const licence = mapLicence(data as Record<string, unknown>);
  if (input.paymentId) {
    await updateLicencePayment(input.paymentId, {
      status: "paid",
      licenceId: licence.id,
      paidAt: new Date().toISOString(),
      paynowStatus: "paid",
    });
  }
  await supabase.from("dvs_audit_log").insert({
    id: crypto.randomUUID(),
    actor_type: input.issuedBy === "dvs" ? "dvs" : "owner",
    action: "issue_animal_licence",
    entity_type: "animal_licence",
    entity_id: licence.id,
    detail: { licenceNumber, petId: input.pet.id, amount, method: input.method },
  });
  if (input.pet.ownerId) {
    await notifyAccount({
      accountId: input.pet.ownerId,
      type: "dvs",
      title: "Council pet registration issued",
      body: `${input.pet.name} is registered with the city council until ${licence.expiresAt}. Registration ${licence.licenceNumber}.`,
    });
  }
  return licence;
}

export async function fulfilPaidLicence(payment: DvsLicencePayment): Promise<DvsAnimalLicence | null> {
  if (payment.status === "paid" && payment.licenceId) {
    const licences = await listDvsAnimalLicences();
    return licences.find((item) => item.id === payment.licenceId) ?? null;
  }
  if (!payment.petId) throw new Error("Payment is not linked to an animal.");
  const pet = await getPetRecordById(payment.petId);
  if (!pet) throw new Error("Animal not found for this payment.");
  return issueDvsAnimalLicence({
    pet,
    amount: payment.amount,
    paymentId: payment.id,
    method: payment.method,
    issuedBy: "paynow",
    notes: `Paid via ${payment.method} ${payment.reference}`,
  });
}

export async function uploadRegistrationProof(file: File, petId: string): Promise<string> {
  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) throw new Error("Upload a photo or PDF of the registration certificate.");
  if (file.size > 8 * 1024 * 1024) throw new Error("File must be under 8MB.");

  const accountId = getSessionAccountId() ?? "guest";
  const ext = file.name.split(".").pop()?.toLowerCase() || (isPdf ? "pdf" : "jpg");
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "pdf"].includes(ext) ? ext : isPdf ? "pdf" : "jpg";
  const path = `${accountId}/registration-${petId}-${Date.now()}.${safeExt}`;
  const { error } = await supabase.storage.from("pet-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || (isPdf ? "application/pdf" : "image/jpeg"),
  });
  if (error) throw error;
  const { data } = supabase.storage.from("pet-photos").getPublicUrl(path);
  return data.publicUrl;
}

async function savePendingProof(id: string, proofUrl: string): Promise<DvsAnimalLicence> {
  const notes = "Council registration proof uploaded. Pending approval.";
  const withProof = await supabase
    .from("dvs_animal_licences")
    .update({ status: "pending", proof_url: proofUrl, notes })
    .eq("id", id)
    .select("*")
    .single();
  if (!withProof.error && withProof.data) return mapLicence(withProof.data as Record<string, unknown>);
  const missingColumn = withProof.error?.code === "42703" || String(withProof.error?.message ?? "").includes("proof_url");
  if (!missingColumn) throw withProof.error;
  const fallback = await supabase
    .from("dvs_animal_licences")
    .update({ status: "pending", notes: `${notes} ${proofUrl}` })
    .eq("id", id)
    .select("*")
    .single();
  if (fallback.error) throw fallback.error;
  return mapLicence(fallback.data as Record<string, unknown>);
}

export async function submitRegistrationProof(pet: Pet, proofUrl: string): Promise<DvsAnimalLicence> {
  const existing = await listLicencesForPet(pet.id);
  const current = existing.find((item) => item.status === "pending" || item.status === "active");
  if (current) return savePendingProof(current.id, proofUrl);

  let ownerName: string | undefined;
  let ownerPhone: string | undefined;
  if (pet.ownerId) {
    const { data } = await supabase.from("accounts").select("full_name, phone").eq("id", pet.ownerId).maybeSingle();
    ownerName = data?.full_name ? String(data.full_name) : undefined;
    ownerPhone = data?.phone ? String(data.phone) : undefined;
  }
  const issuedAt = todayIso();
  const notes = "Council registration proof uploaded. Pending approval.";
  const row = {
    id: crypto.randomUUID(),
    licence_number: await nextLicenceNumber(),
    pet_id: pet.id,
    owner_account_id: pet.ownerId || null,
    owner_name: ownerName || null,
    owner_phone: ownerPhone || null,
    pet_name: pet.name,
    species: pet.species,
    sex: pet.sex,
    issued_at: issuedAt,
    expires_at: addLicenceDays(issuedAt),
    status: "pending",
    amount: 0,
    currency: DVS_LICENCE_FEES.currency,
    issued_by: "owner",
    notes,
  };
  const withProof = await supabase.from("dvs_animal_licences").insert({ ...row, proof_url: proofUrl }).select("*").single();
  if (!withProof.error && withProof.data) return mapLicence(withProof.data as Record<string, unknown>);
  const missingColumn = withProof.error?.code === "42703" || String(withProof.error?.message ?? "").includes("proof_url");
  if (!missingColumn) throw withProof.error;
  const fallback = await supabase
    .from("dvs_animal_licences")
    .insert({ ...row, id: crypto.randomUUID(), notes: `${notes} ${proofUrl}` })
    .select("*")
    .single();
  if (fallback.error) throw fallback.error;
  return mapLicence(fallback.data as Record<string, unknown>);
}

export async function revokeDvsLicence(id: string, notes?: string): Promise<void> {
  const { error } = await supabase.from("dvs_animal_licences").update({ status: "revoked", notes: notes || null }).eq("id", id);
  if (error) throw error;
}

export async function markOfficeLicencePaid(pet: Pet, issuedBy?: string): Promise<DvsAnimalLicence> {
  const amount = dvsLicenceFeeForSpecies(pet.species);
  const payment = await createLicencePaymentRecord({
    pet,
    ownerAccountId: pet.ownerId,
    amount,
    method: "office",
    instructions: "Recorded as a council office payment.",
  });
  return issueDvsAnimalLicence({
    pet,
    amount,
    paymentId: payment.id,
    method: "office",
    issuedBy: issuedBy || "dvs",
    notes: "Registered at the council office",
  });
}

export function buildLicenceFinance(pets: Pet[], licences: DvsAnimalLicence[], payments: DvsLicencePayment[]): DvsLicenceFinance {
  const year = String(new Date().getFullYear());
  const paid = payments.filter((item) => item.status === "paid");
  const pending = payments.filter((item) => item.status === "pending");
  const failed = payments.filter((item) => item.status === "failed" || item.status === "cancelled");
  const licensedIds = new Set(licences.filter((item) => item.status === "active" && item.petId).map((item) => item.petId as string));
  return {
    currency: DVS_LICENCE_FEES.currency,
    paidCount: paid.length,
    pendingCount: pending.length,
    failedCount: failed.length,
    paidAmount: paid.reduce((sum, item) => sum + item.amount, 0),
    pendingAmount: pending.reduce((sum, item) => sum + item.amount, 0),
    activeLicences: licences.filter((item) => item.status === "active").length,
    expiredLicences: licences.filter((item) => item.status === "expired").length,
    unlicensedAnimals: pets.filter((pet) => !licensedIds.has(pet.id)).length,
    yearToDatePaid: paid.filter((item) => (item.paidAt || item.createdAt).startsWith(year)).reduce((sum, item) => sum + item.amount, 0),
  };
}

export async function buildAnimalRegistry(pets: Pet[], licences: DvsAnimalLicence[]): Promise<DvsAnimalRegistryRow[]> {
  const ownerIds = [...new Set(pets.map((pet) => pet.ownerId).filter(Boolean))] as string[];
  const owners = new Map<string, { fullName: string; phone: string }>();
  if (ownerIds.length) {
    const { data } = await supabase.from("accounts").select("id, full_name, phone").in("id", ownerIds);
    for (const row of data ?? []) {
      owners.set(String((row as Record<string, unknown>).id), {
        fullName: String((row as Record<string, unknown>).full_name ?? "Owner"),
        phone: String((row as Record<string, unknown>).phone ?? ""),
      });
    }
  }
  return pets.map((pet) => {
    const licence = currentLicenceForPet(licences, pet.id);
    const owner = pet.ownerId ? owners.get(pet.ownerId) : undefined;
    return {
      pet,
      ownerName: owner?.fullName,
      ownerPhone: owner?.phone,
      licenceStatus: licence ? (licence.status === "active" ? "licensed" : licence.status) : "unlicensed",
      licenceNumber: licence?.licenceNumber,
      licenceExpiresAt: licence?.expiresAt,
    };
  });
}

export async function confirmPendingLicencePayment(paymentId: string, issuedBy?: string): Promise<DvsAnimalLicence | null> {
  const payment = await getLicencePaymentById(paymentId);
  if (!payment) throw new Error("Payment not found.");
  const licence = await fulfilPaidLicence(payment);
  if (issuedBy && licence) {
    await supabase.from("dvs_animal_licences").update({ issued_by: issuedBy }).eq("id", licence.id);
  }
  return licence;
}
