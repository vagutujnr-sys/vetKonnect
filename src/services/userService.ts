import type { AccountType, ModuleId, UserProfile } from "@/types";
import { isAppReadyUser } from "@/lib/account";
import { getDeviceId } from "@/lib/device";
import { createPinHash, isLegacyPinHash, isPin, verifyPinHash } from "@/lib/pin";
import { withTimeout } from "@/lib/timeout";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const SESSION_KEY = "vetkonnect:session_account_id";
const SESSION_PROFILE_KEY = "vetkonnect:session_profile";
const ADMIN_SESSION_KEY = "vetkonnect:admin_session";
const PENDING_PIN_SAVE_KEY = "vetkonnect:pending_pin_save";

export const ADMIN_PIN = "2026";

export const defaultUser: UserProfile = {
  id: undefined,
  fullName: "",
  phone: "",
  countryCode: "+263",
  modules: [],
  vetSureMember: false,
  breedersClubMember: false,
  breedersClubStatus: "none",
  breederShowcasePetId: null,
  onboarded: false,
  isAdmin: false,
  notificationsEnabled: true,
  whatsappOptIn: false,
  boundDeviceId: null,
  avatarUrl: "",
  accountType: "owner",
  vetVerified: false,
  practiceName: "",
  patientsServed: 0,
  blocked: false,
};

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").trim();
}

function mapAccount(row: Record<string, unknown>): UserProfile {
  const accountType = String(row.account_type ?? "owner") === "vet" ? "vet" : "owner";
  const breederStatus = String(row.breeders_club_status ?? "none");
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    phone: String(row.phone ?? ""),
    countryCode: String(row.country_code ?? "+263"),
    modules: (row.modules ?? []) as ModuleId[],
    vetSureMember: Boolean(row.vet_sure_member),
    breedersClubMember: Boolean(row.breeders_club_member ?? row.breeders_club_status === "active"),
    breedersClubStatus: ["none", "pending", "active", "expired", "cancelled", "suspended"].includes(
      breederStatus,
    )
      ? (breederStatus as UserProfile["breedersClubStatus"])
      : "none",
    breederShowcasePetId: row.breeder_showcase_pet_id ? String(row.breeder_showcase_pet_id) : null,
    onboarded: Boolean(row.onboarded),
    isAdmin: Boolean(row.is_admin),
    notificationsEnabled: row.notifications_enabled !== false,
    whatsappOptIn: row.whatsapp_opt_in === true,
    boundDeviceId: row.bound_device_id ? String(row.bound_device_id) : null,
    avatarUrl: String(row.avatar_url ?? ""),
    accountType,
    vetVerified: Boolean(row.vet_verified),
    practiceName: String(row.practice_name ?? ""),
    patientsServed: Number(row.patients_served ?? 0),
    blocked: Boolean(row.blocked),
    dashboardRequestedAt: row.dashboard_requested_at ? String(row.dashboard_requested_at) : null,
    surgeryId: row.surgery_id ? String(row.surgery_id) : null,
  };
}

function assertAccountNotBlocked(user: Pick<UserProfile, "blocked">) {
  if (user.blocked) {
    throw new Error("This account has been blocked by VetKonnect admin.");
  }
}

function cacheSessionProfile(user: UserProfile) {
  if (typeof window === "undefined" || !window.localStorage || !user.id) return;
  window.localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(user));
}

function getCachedSessionProfile(accountId: string): UserProfile | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed.id === accountId ? parsed : null;
  } catch {
    return null;
  }
}

function clearSessionProfileCache() {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(SESSION_PROFILE_KEY);
}

export function getSessionAccountId(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage.getItem(SESSION_KEY);
}

function setSessionAccountId(id: string | null) {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (!id) {
    window.localStorage.removeItem(SESSION_KEY);
    clearSessionProfileCache();
    return;
  }
  window.localStorage.setItem(SESSION_KEY, id);
}

function isAdminSession(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  return window.localStorage.getItem(ADMIN_SESSION_KEY) === "1";
}

export function getCachedUser(): UserProfile | null {
  const sessionId = getSessionAccountId();
  if (!sessionId) return null;
  const cached = getCachedSessionProfile(sessionId);
  return cached ? { ...cached, isAdmin: cached.isAdmin || isAdminSession() } : null;
}

export function setAdminSession(active: boolean) {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (active) window.localStorage.setItem(ADMIN_SESSION_KEY, "1");
  else window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

export async function getUser(): Promise<UserProfile> {
  const sessionId = getSessionAccountId();
  if (!sessionId) {
    if (isAdminSession()) {
      return {
        ...defaultUser,
        id: "admin-session",
        fullName: "Super Admin",
        phone: "admin",
        onboarded: true,
        modules: ["pets", "community", "marketplace", "rescue", "tips", "farm"],
        isAdmin: true,
        boundDeviceId: getDeviceId(),
      };
    }
    return defaultUser;
  }

  const cached = getCachedSessionProfile(sessionId);

  if (!isSupabaseConfigured) {
    return cached
      ? { ...cached, isAdmin: cached.isAdmin || isAdminSession() }
      : { ...defaultUser, id: sessionId, boundDeviceId: getDeviceId(), onboarded: true };
  }

  let data: Record<string, unknown> | null = null;
  try {
    const result = await withTimeout(
      supabase.from("accounts").select("*").eq("id", sessionId).maybeSingle(),
      5000,
      "Account session",
    );
    if (result.error) throw result.error;
    data = (result.data as Record<string, unknown> | null) ?? null;
  } catch (error) {
    console.error("Failed to refresh account session", error);
    if (cached) return { ...cached, isAdmin: cached.isAdmin || isAdminSession() };
    return {
      ...defaultUser,
      id: sessionId,
      boundDeviceId: getDeviceId(),
      onboarded: true,
    };
  }

  if (!data) {
    if (getSessionAccountId() === sessionId) setSessionAccountId(null);
    return defaultUser;
  }

  const account = mapAccount(data as Record<string, unknown>);

  if (account.blocked) {
    if (getSessionAccountId() === sessionId) setSessionAccountId(null);
    return defaultUser;
  }

  const next = { ...account, isAdmin: account.isAdmin || isAdminSession() };
  cacheSessionProfile(next);
  return next;
}

export async function updateUser(patch: Partial<UserProfile>): Promise<UserProfile> {
  const current = await getUser();
  if (!current.id || current.id === "admin-session") {
    return { ...current, ...patch };
  }

  const next = { ...current, ...patch };
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.fullName !== undefined) payload.full_name = next.fullName;
  if (patch.phone !== undefined) payload.phone = normalizePhone(next.phone);
  if (patch.countryCode !== undefined) payload.country_code = next.countryCode;
  if (patch.modules !== undefined) payload.modules = next.modules;
  if (patch.onboarded !== undefined) payload.onboarded = next.onboarded;
  if (patch.vetSureMember !== undefined) payload.vet_sure_member = next.vetSureMember;
  if (patch.breedersClubMember !== undefined)
    payload.breeders_club_member = Boolean(next.breedersClubMember);
  if (patch.breedersClubStatus !== undefined)
    payload.breeders_club_status = next.breedersClubStatus;
  if (patch.breederShowcasePetId !== undefined)
    payload.breeder_showcase_pet_id = next.breederShowcasePetId || null;
  if (patch.notificationsEnabled !== undefined)
    payload.notifications_enabled = next.notificationsEnabled !== false;
  if (patch.whatsappOptIn !== undefined) payload.whatsapp_opt_in = Boolean(next.whatsappOptIn);
  if (patch.avatarUrl !== undefined) payload.avatar_url = next.avatarUrl ?? "";
  if (patch.practiceName !== undefined) payload.practice_name = next.practiceName ?? "";
  if (patch.patientsServed !== undefined)
    payload.patients_served = Number(next.patientsServed ?? 0);
  if (patch.surgeryId !== undefined) payload.surgery_id = next.surgeryId || null;

  // Admin-controlled fields — only write when explicitly patched so stale client
  // cache cannot overwrite elevation / block status from the dashboard.
  if (patch.isAdmin !== undefined) payload.is_admin = Boolean(next.isAdmin);
  if (patch.accountType !== undefined)
    payload.account_type = next.accountType === "vet" ? "vet" : "owner";
  if (patch.vetVerified !== undefined) payload.vet_verified = Boolean(next.vetVerified);
  if (patch.blocked !== undefined) payload.blocked = Boolean(next.blocked);

  if (Object.keys(payload).length === 1) {
    cacheSessionProfile(next);
    return next;
  }

  let { error } = await supabase.from("accounts").update(payload).eq("id", current.id);

  // Retry without surgery_id when migration 011 is not applied yet.
  if (error && payload.surgery_id !== undefined) {
    const message = `${error.message ?? ""}`.toLowerCase();
    if (message.includes("surgery_id")) {
      const { surgery_id: _removed, ...rest } = payload;
      const retry = await supabase.from("accounts").update(rest).eq("id", current.id);
      error = retry.error;
    }
  }

  if (error) {
    const message = `${error.message ?? ""}`.toLowerCase();
    if (message.includes("whatsapp_opt_in")) {
      throw new Error("WhatsApp opt-in is not installed yet. Apply migration 030_whatsapp_opt_in.sql in Supabase.");
    }
    throw error;
  }

  // Re-read so admin elevation / verification changes win over any local merge.
  const refreshed = await getUser();
  const merged = { ...refreshed, ...patch, id: refreshed.id || current.id };
  // Prefer server values for admin-controlled fields after write.
  merged.accountType = refreshed.accountType;
  merged.vetVerified = refreshed.vetVerified;
  merged.blocked = refreshed.blocked;
  merged.isAdmin = refreshed.isAdmin;
  merged.surgeryId = refreshed.surgeryId ?? patch.surgeryId ?? null;
  cacheSessionProfile(merged);
  return merged;
}

/** Link a vet account to a directory surgery (or clear the link). */
export async function alignWithSurgery(surgeryId: string | null): Promise<UserProfile> {
  const user = await getUser();
  if (!user.id || user.accountType !== "vet") {
    throw new Error("Only vet accounts can align with a surgery.");
  }

  let practiceName = user.practiceName?.trim() || `${user.fullName?.trim() || "Vet"}'s Practice`;

  if (surgeryId) {
    const { data, error } = await supabase
      .from("vets")
      .select("id,name,surgery,location")
      .eq("id", surgeryId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Surgery not found.");
    practiceName = String(data.surgery || data.name || "").trim() || practiceName;
  }

  return updateUser({
    surgeryId: surgeryId || null,
    practiceName,
  });
}

export async function uploadProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Photo must be under 8MB.");
  }

  const accountId = getSessionAccountId();
  if (!accountId) throw new Error("You must be logged in to update your photo.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext) ? ext : "jpg";
  const path = `${accountId}/avatar-${Date.now()}.${safeExt}`;

  const { error } = await supabase.storage.from("profile-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function resetUser(): Promise<void> {
  setSessionAccountId(null);
  setAdminSession(false);
}

export type AccessCodeResult = {
  accountId: string;
  isNew: boolean;
  hasPin: boolean;
  fullName: string;
  phone: string;
  countryCode: string;
  /** Account already read while looking up the phone, so PIN confirm does not fetch it again. */
  profile: UserProfile;
  /** Present only until the PIN step. Lets a returning sign-in check the PIN without another request. */
  pinHash: string;
};

const accessLookups = new Map<string, Promise<AccessCodeResult>>();

function accessLookupKey(phone: string, countryCode: string, accountType?: AccountType) {
  return `${countryCode}:${normalizePhone(phone)}:${accountType === "vet" ? "vet" : "owner"}`;
}

/** Start the account lookup immediately so the PIN screen can open while Supabase answers. */
export function beginAccessLookup(
  phone: string,
  countryCode = "+263",
  options?: { accountType?: AccountType },
): Promise<AccessCodeResult> {
  const key = accessLookupKey(phone, countryCode, options?.accountType);
  const current = accessLookups.get(key);
  if (current) return current;
  const started = requestAccessCode(phone, countryCode, options).catch((error) => {
    accessLookups.delete(key);
    throw error;
  });
  accessLookups.set(key, started);
  void started.then(() => {
    setTimeout(() => {
      if (accessLookups.get(key) === started) accessLookups.delete(key);
    }, 20000);
  });
  return started;
}

/** Look up a phone and open PIN sign-in, or start a new account that still needs a PIN. */
export async function requestAccessCode(
  phone: string,
  countryCode = "+263",
  options?: { accountType?: AccountType },
): Promise<AccessCodeResult> {
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 6) {
    throw new Error("Enter a valid mobile number.");
  }

  const registerAsVet = options?.accountType === "vet";
  const { data: existing, error: lookupError } = await withTimeout(
    supabase.from("accounts").select("*").eq("phone", cleanPhone).maybeSingle(),
    4000,
    "Account lookup",
  );

  if (lookupError) throw lookupError;

  if (existing) {
    assertAccountNotBlocked(mapAccount(existing as Record<string, unknown>));
    const existingPatch: Record<string, unknown> = {
      country_code: countryCode,
    };
    if (registerAsVet) {
      existingPatch.account_type = "vet";
      existingPatch.vet_verified = false;
      existingPatch.updated_at = new Date().toISOString();
      if (!Array.isArray(existing.modules) || (existing.modules as unknown[]).length === 0) {
        existingPatch.modules = ["community", "tips"];
      }
      const { error } = await withTimeout(
        supabase.from("accounts").update(existingPatch).eq("id", existing.id),
        2500,
        "Account update",
      );
      if (error) throw error;
    }
    const pinHash = String(existing.pin_hash ?? "").trim();
    const profile = mapAccount({ ...(existing as Record<string, unknown>), ...existingPatch });
    return {
      accountId: String(existing.id),
      isNew: false,
      hasPin: Boolean(pinHash),
      fullName: profile.fullName,
      phone: cleanPhone,
      countryCode,
      profile,
      pinHash,
    };
  }

  const id = crypto.randomUUID();
  const { data, error } = await withTimeout(
    supabase
      .from("accounts")
      .insert({
        id,
        phone: cleanPhone,
        country_code: countryCode,
        full_name: "",
        modules: registerAsVet ? ["community", "tips"] : [],
        onboarded: false,
        account_type: registerAsVet ? "vet" : "owner",
        vet_verified: false,
        otp_code: null,
        otp_expires_at: null,
      })
      .select("*")
      .single(),
    4000,
    "Account create",
  );

  if (error) throw error;

  return {
    accountId: String(data.id),
    isNew: true,
    hasPin: false,
    fullName: "",
    phone: cleanPhone,
    countryCode,
    profile: mapAccount(data as Record<string, unknown>),
    pinHash: "",
  };
}

export class IncorrectPinError extends Error {
  constructor() {
    super("Incorrect PIN. Try again.");
    this.name = "IncorrectPinError";
  }
}

function pinColumnError(error: { message?: string }): Error {
  const message = String(error.message ?? "");
  if (message.toLowerCase().includes("pin_hash")) {
    return new Error(
      "PIN sign-in is not installed yet. Apply migration 022_account_pin.sql in Supabase.",
    );
  }
  return error instanceof Error ? error : new Error(message || "Could not save the PIN.");
}

function rememberSession(user: UserProfile) {
  if (!user.id) throw new Error("Could not start your session. Try again.");
  setSessionAccountId(user.id);
  cacheSessionProfile(user);
}

type PendingPinSave = {
  accountId: string;
  pinHash: string;
  fullName: string;
  isVet: boolean;
  modules: UserProfile["modules"];
  practiceName: string;
};

function readPendingPinSave(): PendingPinSave | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PENDING_PIN_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPinSave;
    if (!parsed.accountId || !parsed.pinHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

function queuePendingPinSave(row: PendingPinSave) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(PENDING_PIN_SAVE_KEY, JSON.stringify(row));
}

function clearPendingPinSave() {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.removeItem(PENDING_PIN_SAVE_KEY);
}

async function persistPinSave(row: PendingPinSave): Promise<void> {
  const payload: Record<string, unknown> = {
    full_name: row.fullName,
    pin_hash: row.pinHash,
    otp_code: null,
    otp_expires_at: null,
    updated_at: new Date().toISOString(),
  };
  if (row.isVet) {
    payload.onboarded = true;
    payload.modules = row.modules;
    payload.practice_name = row.practiceName;
  }
  const { error } = await withTimeout(
    supabase.from("accounts").update(payload).eq("id", row.accountId),
    2500,
    "PIN save",
  );
  if (error) throw pinColumnError(error);
  clearPendingPinSave();
}

/** Finish a PIN write that was still in flight when the sign-in screen closed. */
export function flushPendingPinSave(): void {
  const row = readPendingPinSave();
  if (!row) return;
  void persistPinSave(row).catch((error) => console.warn("PIN save retry failed", error));
}

function refreshStoredPin(accountId: string, pin: string) {
  void (async () => {
    try {
      const pinHash = await createPinHash(pin);
      const { error: refreshError } = await supabase
        .from("accounts")
        .update({ pin_hash: pinHash, updated_at: new Date().toISOString() })
        .eq("id", accountId);
      if (refreshError) console.warn("Could not refresh stored PIN", refreshError);
    } catch (refreshError) {
      console.warn("Could not refresh stored PIN", refreshError);
    }
  })();
}

/** Create the 5-digit PIN for a new account, or an older account that never had one. */
export async function setAccountPin(input: {
  accountId: string;
  pin: string;
  fullName?: string;
  profile?: UserProfile;
}): Promise<UserProfile> {
  if (!isPin(input.pin)) throw new Error("Enter a 5-digit PIN.");
  const known = input.profile?.id === input.accountId ? input.profile : null;
  let base = known;

  if (!base) {
    const { data, error } = await withTimeout(
      supabase.from("accounts").select("*").eq("id", input.accountId).maybeSingle(),
      2000,
      "PIN account lookup",
    );
    if (error) throw error;
    if (!data) throw new Error("Account not found. Start again from login.");
    base = mapAccount(data as Record<string, unknown>);
  }

  assertAccountNotBlocked(base);
  const fullName = (input.fullName ?? base.fullName).trim() || base.fullName.trim();
  if (fullName.length < 2) throw new Error("Enter your name.");
  const isVet = base.accountType === "vet";
  const pinHash = await createPinHash(input.pin);
  const vetModules = base.modules.length ? base.modules : (["community", "tips"] as UserProfile["modules"]);
  const practiceName = base.practiceName?.trim() || `${fullName}'s Practice`;
  const user: UserProfile = {
    ...base,
    fullName,
    ...(isVet
      ? {
          onboarded: true,
          modules: vetModules,
          practiceName,
        }
      : {}),
  };
  rememberSession(user);
  const pendingSave: PendingPinSave = {
    accountId: input.accountId,
    pinHash,
    fullName,
    isVet,
    modules: vetModules,
    practiceName,
  };
  queuePendingPinSave(pendingSave);
  void persistPinSave(pendingSave).catch((error) => console.warn("PIN save continuing after sign-in", error));
  return user;
}

/** Read the stored PIN hash once so a change can be checked on the phone. */
export async function readAccountPinHash(accountId: string): Promise<string> {
  const { data, error } = await withTimeout(
    supabase.from("accounts").select("pin_hash").eq("id", accountId).maybeSingle(),
    2500,
    "PIN lookup",
  );
  if (error) throw error;
  const stored = String((data as { pin_hash?: string } | null)?.pin_hash ?? "").trim();
  if (!stored) throw new Error("This account does not have a PIN yet.");
  return stored;
}

/** Replace the signed-in account PIN after the current one matches. */
export async function changeAccountPin(input: {
  accountId: string;
  currentPin: string;
  nextPin: string;
  pinHash: string;
}): Promise<void> {
  if (!isPin(input.currentPin) || !isPin(input.nextPin)) throw new Error("Enter a 5-digit PIN.");
  if (input.currentPin === input.nextPin) throw new Error("Choose a different PIN from the one you use now.");
  const ok = await verifyPinHash(input.currentPin, input.pinHash);
  if (!ok) throw new IncorrectPinError();
  const pinHash = await createPinHash(input.nextPin);
  const { error } = await withTimeout(
    supabase
      .from("accounts")
      .update({ pin_hash: pinHash, updated_at: new Date().toISOString() })
      .eq("id", input.accountId),
    2500,
    "PIN save",
  );
  if (error) throw pinColumnError(error);
}

/** Sign a returning account in with its 5-digit PIN. */
export async function verifyAccountPin(input: {
  accountId: string;
  pin: string;
  pinHash?: string;
  profile?: UserProfile;
}): Promise<UserProfile> {
  if (!isPin(input.pin)) throw new Error("Enter your 5-digit PIN.");
  const known = input.profile?.id === input.accountId ? input.profile : null;
  const cachedHash = String(input.pinHash ?? "").trim();

  if (known && cachedHash) {
    assertAccountNotBlocked(known);
    const ok = await verifyPinHash(input.pin, cachedHash);
    if (!ok) throw new IncorrectPinError();
    rememberSession(known);
    if (isLegacyPinHash(cachedHash)) refreshStoredPin(input.accountId, input.pin);
    return known;
  }

  const { data, error } = await withTimeout(
    supabase.from("accounts").select("*").eq("id", input.accountId).maybeSingle(),
    2000,
    "PIN account lookup",
  );
  if (error) throw error;
  if (!data) throw new Error("Account not found. Start again from login.");
  const user = mapAccount(data as Record<string, unknown>);
  assertAccountNotBlocked(user);

  const stored = String(data.pin_hash ?? "").trim();
  if (!stored) throw new Error("This account does not have a PIN yet.");
  const ok = await verifyPinHash(input.pin, stored);
  if (!ok) throw new IncorrectPinError();

  rememberSession(user);
  if (isLegacyPinHash(stored)) refreshStoredPin(input.accountId, input.pin);
  return user;
}

/** Security feature: release this account from the current device. */
export async function unbindDevice(): Promise<void> {
  const current = await getUser();
  if (!current.id) return;

  const { error } = await supabase
    .from("accounts")
    .update({
      bound_device_id: null,
      device_bound_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id);

  if (error) throw error;
  setSessionAccountId(null);
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getUser();
  return isAppReadyUser(user);
}

export async function hasActiveSession(): Promise<boolean> {
  const sessionId = getSessionAccountId();
  if (sessionId) {
    const cached = getCachedSessionProfile(sessionId);
    if (cached?.id) return true;
    return true;
  }
  if (isAdminSession()) return true;
  const user = await getUser();
  return Boolean(user.id);
}
