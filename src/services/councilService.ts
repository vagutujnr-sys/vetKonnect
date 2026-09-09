import { HARARE } from "@/lib/geo";
import { supabase } from "@/services/supabaseClient";
import { getAllPets, findPetByTag } from "@/services/petService";
import type {
  AnimalControlCase,
  AnimalCaseType,
  CommunityPost,
  CouncilDashboardStats,
  CouncilMapPoint,
  CouncilOfficial,
  CouncilPetLookup,
  CouncilTagScanResult,
  MediaType,
  Pet,
  PetLicence,
} from "@/types";

const SESSION_KEY = "vetkonnect:council_session_id";
const OFFICIAL_CACHE_KEY = "vetkonnect:council_official";

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

function mapOfficial(row: Record<string, unknown>): CouncilOfficial {
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    fullName: String(row.full_name ?? ""),
    title: row.title ? String(row.title) : undefined,
    active: Boolean(row.active ?? true),
    createdAt: String(row.created_at ?? ""),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  };
}

function mapLicence(row: Record<string, unknown>): PetLicence {
  return {
    id: String(row.id),
    petId: row.pet_id ? String(row.pet_id) : null,
    licenceNumber: String(row.licence_number ?? ""),
    ownerName: row.owner_name ? String(row.owner_name) : undefined,
    petName: row.pet_name ? String(row.pet_name) : undefined,
    species: row.species ? String(row.species) : undefined,
    issuedAt: String(row.issued_at ?? ""),
    expiresAt: String(row.expires_at ?? ""),
    status: (row.status as PetLicence["status"]) || "active",
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function mapCase(row: Record<string, unknown>): AnimalControlCase {
  return {
    id: String(row.id),
    caseType: row.case_type as AnimalControlCase["caseType"],
    status: (row.status as AnimalControlCase["status"]) || "open",
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : undefined,
    species: row.species ? String(row.species) : undefined,
    petId: row.pet_id ? String(row.pet_id) : null,
    petName: row.pet_name ? String(row.pet_name) : undefined,
    locationLabel: row.location_label ? String(row.location_label) : undefined,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    reportedAt: String(row.reported_at ?? ""),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    reportedBy: row.reported_by ? String(row.reported_by) : undefined,
  };
}

export function getCouncilSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function clearCouncilSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(OFFICIAL_CACHE_KEY);
}

function setCouncilSession(official: CouncilOfficial): void {
  localStorage.setItem(SESSION_KEY, official.id);
  localStorage.setItem(OFFICIAL_CACHE_KEY, JSON.stringify(official));
}

export async function getCouncilSessionOfficial(): Promise<CouncilOfficial | null> {
  const id = getCouncilSessionId();
  if (!id) return null;

  try {
    const cached = localStorage.getItem(OFFICIAL_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as CouncilOfficial;
      if (parsed.id === id) return parsed;
    }
  } catch {
    /* ignore */
  }

  const { data, error } = await supabase.from("council_accounts").select("*").eq("id", id).maybeSingle();
  if (error || !data) {
    clearCouncilSession();
    return null;
  }
  const official = mapOfficial(data as Record<string, unknown>);
  if (!official.active) {
    clearCouncilSession();
    return null;
  }
  setCouncilSession(official);
  return official;
}

export async function loginCouncilOfficial(email: string, password: string): Promise<CouncilOfficial> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) throw new Error("Email and password are required.");

  const { data, error } = await supabase.from("council_accounts").select("*").ilike("email", normalized).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No council account found for that email.");

  const official = mapOfficial(data as Record<string, unknown>);
  if (!official.active) throw new Error("This council account is inactive. Contact VetKonnect admin.");

  const ok = await verifyPassword(password, String((data as Record<string, unknown>).password_hash ?? ""));
  if (!ok) throw new Error("Incorrect password.");

  await supabase.from("council_accounts").update({ last_login_at: new Date().toISOString() }).eq("id", official.id);
  setCouncilSession(official);
  return official;
}

export async function listCouncilOfficials(): Promise<CouncilOfficial[]> {
  const { data, error } = await supabase.from("council_accounts").select("*").order("created_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapOfficial(row as Record<string, unknown>));
}

export async function createCouncilOfficial(input: {
  email: string;
  password: string;
  fullName: string;
  title?: string;
}): Promise<CouncilOfficial> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email || !fullName || !input.password) {
    throw new Error("Full name, email, and password are required.");
  }
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await createPasswordHash(input.password);
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from("council_accounts")
    .insert({
      id,
      email,
      password_hash: passwordHash,
      full_name: fullName,
      title: input.title?.trim() || null,
      active: true,
    })
    .select("*")
    .single();

  if (error) {
    if (String(error.message).toLowerCase().includes("duplicate") || error.code === "23505") {
      throw new Error("A council official with that email already exists.");
    }
    throw error;
  }
  return mapOfficial(data as Record<string, unknown>);
}

export async function setCouncilOfficialActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("council_accounts").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteCouncilOfficial(id: string): Promise<void> {
  const { error } = await supabase.from("council_accounts").delete().eq("id", id);
  if (error) throw error;
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return error.code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

function refreshLicenceStatuses(licences: PetLicence[]): PetLicence[] {
  const today = new Date().toISOString().slice(0, 10);
  return licences.map((licence) => {
    if (licence.status === "revoked") return licence;
    const nextStatus = licence.expiresAt < today ? "expired" : "active";
    return nextStatus === licence.status ? licence : { ...licence, status: nextStatus };
  });
}

export async function listPetLicences(): Promise<PetLicence[]> {
  const { data, error } = await supabase.from("pet_licences").select("*").order("expires_at", { ascending: true });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return refreshLicenceStatuses((data ?? []).map((row) => mapLicence(row as Record<string, unknown>)));
}

export async function listAnimalControlCases(): Promise<AnimalControlCase[]> {
  const { data, error } = await supabase
    .from("animal_control_cases")
    .select("*")
    .order("reported_at", { ascending: false });
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => mapCase(row as Record<string, unknown>));
}

function hasRabiesRecord(pet: Pet): boolean {
  const next = (pet.nextVaccine ?? "").toLowerCase();
  if (next.includes("rabies")) return true;
  return (pet.timeline ?? []).some((event) => {
    const blob = `${event.title} ${event.detail}`.toLowerCase();
    return event.type === "vaccine" && blob.includes("rabies");
  });
}

function openCount(cases: AnimalControlCase[], type: AnimalCaseType): number {
  return cases.filter((c) => c.caseType === type && c.status === "open").length;
}

export async function getCouncilDashboardSnapshot(): Promise<{
  stats: CouncilDashboardStats;
  licences: PetLicence[];
  cases: AnimalControlCase[];
  dogs: Pet[];
  mapPoints: CouncilMapPoint[];
  rabiesMissingDogs: Pet[];
}> {
  const [pets, licencesRaw, cases] = await Promise.all([getAllPets(), listPetLicences(), listAnimalControlCases()]);
  const licences = refreshLicenceStatuses(licencesRaw);
  const dogs = pets.filter((p) => String(p.species).toLowerCase() === "dog");
  const licensedPetIds = new Set(licences.filter((l) => l.petId).map((l) => l.petId as string));
  const activeLicences = licences.filter((l) => l.status === "active").length;
  const expiredLicences = licences.filter((l) => l.status === "expired").length;
  const dogsWithoutLicence = dogs.filter((d) => !licensedPetIds.has(d.id)).length;
  const compliantDogs = dogs.length - dogsWithoutLicence;
  const licenceCompliancePct = dogs.length === 0 ? 100 : Math.round((compliantDogs / dogs.length) * 100);
  const rabiesRecorded = dogs.filter(hasRabiesRecord).length;
  const rabiesMissingDogs = dogs.filter((d) => !hasRabiesRecord(d));

  const mapPoints: CouncilMapPoint[] = [];
  for (const item of cases) {
    if (item.latitude == null || item.longitude == null) continue;
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;
    mapPoints.push({
      id: item.id,
      label: item.title,
      kind: item.caseType,
      latitude: item.latitude,
      longitude: item.longitude,
      detail: item.locationLabel ?? item.caseType,
    });
  }

  // Scatter registered dogs near Harare when owner coords aren't on pets — use stable hash offsets.
  dogs.slice(0, 80).forEach((dog, index) => {
    const seed = [...dog.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const lat = HARARE.latitude + ((seed % 40) - 20) * 0.004 + (index % 5) * 0.001;
    const lng = HARARE.longitude + (((seed >> 3) % 40) - 20) * 0.004 + (index % 7) * 0.001;
    mapPoints.push({
      id: `dog-${dog.id}`,
      label: dog.name,
      kind: "registered",
      latitude: lat,
      longitude: lng,
      detail: `${dog.breed} · ${licensedPetIds.has(dog.id) ? "Licensed" : "Unlicensed"}`,
    });
  });

  return {
    stats: {
      registeredDogs: dogs.length,
      registeredPets: pets.length,
      activeLicences,
      expiredLicences,
      licenceCompliancePct,
      dogsWithoutLicence,
      rabiesRecorded,
      rabiesMissing: rabiesMissingDogs.length,
      lostOpen: openCount(cases, "lost"),
      foundOpen: openCount(cases, "found"),
      impoundedOpen: openCount(cases, "impound"),
      incidentsOpen: openCount(cases, "incident"),
    },
    licences,
    cases,
    dogs,
    mapPoints,
    rabiesMissingDogs,
  };
}

/** Seeds municipal sample licences/cases from live pets when tables are empty. */
export async function syncCouncilMunicipalSample(): Promise<{ licences: number; cases: number }> {
  const pets = await getAllPets();
  const dogs = pets.filter((p) => String(p.species).toLowerCase() === "dog");
  const existingLicences = await listPetLicences();
  const existingCases = await listAnimalControlCases();

  let licencesCreated = 0;
  if (existingLicences.length === 0 && dogs.length > 0) {
    const today = new Date();
    const rows = dogs.map((dog, index) => {
      const issued = new Date(today);
      issued.setMonth(issued.getMonth() - (index % 18));
      const expires = new Date(issued);
      expires.setFullYear(expires.getFullYear() + 1);
      const expired = expires < today;
      return {
        id: crypto.randomUUID(),
        pet_id: dog.id,
        licence_number: `HCC-${String(1000 + index)}`,
        owner_name: null,
        pet_name: dog.name,
        species: dog.species,
        issued_at: issued.toISOString().slice(0, 10),
        expires_at: expires.toISOString().slice(0, 10),
        status: expired ? "expired" : "active",
        notes: "Synced from VetKonnect pet registry",
      };
    });
    const { error } = await supabase.from("pet_licences").insert(rows);
    if (error) throw error;
    licencesCreated = rows.length;
  }

  let casesCreated = 0;
  if (existingCases.length === 0) {
    const samples: Array<{
      case_type: AnimalCaseType;
      title: string;
      description: string;
      species: string;
      location_label: string;
      latitude: number;
      longitude: number;
    }> = [
      {
        case_type: "lost",
        title: "Lost dog — Borrowdale",
        description: "Brown mixed-breed last seen near Borrowdale Brooke.",
        species: "Dog",
        location_label: "Borrowdale",
        latitude: -17.7845,
        longitude: 31.0443,
      },
      {
        case_type: "found",
        title: "Found cat — CBD",
        description: "Grey tabby brought in by member of public.",
        species: "Cat",
        location_label: "Harare CBD",
        latitude: -17.8252,
        longitude: 31.0335,
      },
      {
        case_type: "impound",
        title: "Impounded stray pack",
        description: "Three unclaimed dogs held pending reclaim.",
        species: "Dog",
        location_label: "Municipal pound",
        latitude: -17.845,
        longitude: 31.07,
      },
      {
        case_type: "incident",
        title: "Bite incident report",
        description: "Dog bite reported; vaccination status under review.",
        species: "Dog",
        location_label: "Mbare",
        latitude: -17.859,
        longitude: 31.038,
      },
      {
        case_type: "incident",
        title: "Noise / roaming complaint",
        description: "Neighbour complaint of roaming unlicensed dogs.",
        species: "Dog",
        location_label: "Avondale",
        latitude: -17.8,
        longitude: 31.035,
      },
    ];

    const rows = samples.map((sample) => ({
      id: crypto.randomUUID(),
      ...sample,
      status: "open",
      reported_at: new Date().toISOString(),
      reported_by: "Municipal sample sync",
    }));
    const { error } = await supabase.from("animal_control_cases").insert(rows);
    if (error) throw error;
    casesCreated = rows.length;
  }

  return { licences: licencesCreated, cases: casesCreated };
}

export async function lookupPetForCouncil(raw: string): Promise<CouncilTagScanResult> {
  const scannedCode = raw.trim();
  if (!scannedCode) throw new Error("Scan or enter a pet tag / VetKonnect ID.");

  const pet = await findPetByTag(scannedCode);
  if (!pet) {
    return { registered: false, scannedCode };
  }

  let owner: CouncilPetLookup["owner"] = null;
  if (pet.ownerId) {
    const { data, error } = await supabase
      .from("accounts")
      .select("id, full_name, phone, country_code")
      .eq("id", pet.ownerId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      owner = {
        id: String(data.id),
        fullName: String(data.full_name ?? "Unknown owner"),
        phone: String(data.phone ?? ""),
        countryCode: String(data.country_code ?? ""),
      };
    }
  }

  const licences = await listPetLicences();
  const licence = licences.find((item) => item.petId === pet.id) ?? null;
  let licenceStatus: CouncilPetLookup["licenceStatus"] = "unlicensed";
  if (licence) {
    if (licence.status === "active") licenceStatus = "licensed";
    else if (licence.status === "expired") licenceStatus = "expired";
    else licenceStatus = "revoked";
  }

  return { registered: true, scannedCode, pet, owner, licence, licenceStatus };
}

/** App-wide notice — inserts a row per account so realtime/poll delivery reaches every device. */
export async function broadcastCouncilNotification(input: {
  title: string;
  body: string;
}): Promise<number> {
  const official = await getCouncilSessionOfficial();
  if (!official) throw new Error("Council session required.");

  const { data, error } = await supabase.from("accounts").select("id");
  if (error) throw error;
  const accountIds = (data ?? []).map((row) => String(row.id));
  if (!accountIds.length) return 0;

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new Error("Title and message are required.");

  const rows = accountIds.map((accountId) => ({
    id: crypto.randomUUID(),
    account_id: accountId,
    title,
    body,
    type: "council",
    read: false,
    created_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase.from("notifications").insert(rows);
  if (insertError) throw insertError;
  return rows.length;
}

export async function uploadCouncilCommunityMedia(
  file: File,
): Promise<{ url: string; mediaType: "image" | "video" }> {
  const official = await getCouncilSessionOfficial();
  if (!official) throw new Error("Council session required.");

  const isVideo = file.type.startsWith("video/");
  const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
  const path = `council/${official.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("community-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("community-media").getPublicUrl(path);
  return { url: data.publicUrl, mediaType: isVideo ? "video" : "image" };
}

export async function createCouncilCommunityPost(input: {
  body: string;
  tag: CommunityPost["tag"];
  location?: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  notifyAppWide?: boolean;
}): Promise<CommunityPost> {
  const official = await getCouncilSessionOfficial();
  if (!official) throw new Error("Council session required.");

  const body = input.body.trim();
  if (!body) throw new Error("Post text is required.");

  const mediaType = input.mediaType ?? (input.mediaUrl ? "image" : "none");
  const authorName = official.title
    ? `City Council · ${official.title}`
    : `City Council · ${official.fullName}`;

  const row = {
    id: crypto.randomUUID(),
    author_id: official.id,
    author: authorName,
    location: input.location?.trim() || "Harare City Council",
    time_ago: "Just now",
    avatar_url: "",
    image_url: mediaType === "image" ? input.mediaUrl ?? "" : "",
    video_url: mediaType === "video" ? input.mediaUrl ?? "" : "",
    media_type: mediaType,
    body,
    likes: 0,
    comments: 0,
    views: 0,
    tag: input.tag,
    liked_by: [],
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("community_posts").insert(row).select("*").single();
  if (error) throw error;

  if (input.notifyAppWide) {
    await broadcastCouncilNotification({
      title: "City Council update",
      body: body.length > 120 ? `${body.slice(0, 117)}…` : body,
    });
  }

  return {
    id: String(data.id),
    authorId: official.id,
    author: authorName,
    location: String(data.location ?? ""),
    timeAgo: "Just now",
    avatarUrl: "",
    imageUrl: String(data.image_url ?? ""),
    videoUrl: String(data.video_url ?? ""),
    mediaType,
    body,
    likes: 0,
    comments: 0,
    views: 0,
    tag: input.tag,
    createdAt: String(data.created_at ?? ""),
  };
}
