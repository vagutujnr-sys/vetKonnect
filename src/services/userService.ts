import type { ModuleId, UserProfile } from "@/types";
import { getDeviceId } from "@/lib/device";
import { supabase } from "./supabaseClient";

const SESSION_KEY = "vetkonnect:session_account_id";
const SESSION_PROFILE_KEY = "vetkonnect:session_profile";
const ADMIN_SESSION_KEY = "vetkonnect:admin_session";

export const ADMIN_PIN = "2026";

export const defaultUser: UserProfile = {
  id: undefined,
  fullName: "",
  phone: "",
  countryCode: "+263",
  modules: [],
  vetSureMember: false,
  onboarded: false,
  isAdmin: false,
  notificationsEnabled: true,
  boundDeviceId: null,
};

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, "").trim();
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function mapAccount(row: Record<string, unknown>): UserProfile {
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    phone: String(row.phone ?? ""),
    countryCode: String(row.country_code ?? "+263"),
    modules: (row.modules ?? []) as ModuleId[],
    vetSureMember: Boolean(row.vet_sure_member),
    onboarded: Boolean(row.onboarded),
    isAdmin: Boolean(row.is_admin),
    notificationsEnabled: row.notifications_enabled !== false,
    boundDeviceId: row.bound_device_id ? String(row.bound_device_id) : null,
  };
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

  const { data, error } = await supabase.from("accounts").select("*").eq("id", sessionId).maybeSingle();

  // Never wipe a valid local session on transient network / API failures.
  if (error) {
    console.error("Failed to refresh account session", error);
    const cached = getCachedSessionProfile(sessionId);
    if (cached) return { ...cached, isAdmin: cached.isAdmin || isAdminSession() };
    return {
      ...defaultUser,
      id: sessionId,
      boundDeviceId: getDeviceId(),
      onboarded: true,
    };
  }

  if (!data) {
    setSessionAccountId(null);
    return defaultUser;
  }

  const account = mapAccount(data as Record<string, unknown>);
  const deviceId = getDeviceId();

  // Session is only valid on the bound device.
  if (account.boundDeviceId && account.boundDeviceId !== deviceId) {
    setSessionAccountId(null);
    return defaultUser;
  }

  if (!account.boundDeviceId) {
    setSessionAccountId(null);
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
  const { error } = await supabase
    .from("accounts")
    .update({
      full_name: next.fullName,
      phone: normalizePhone(next.phone),
      country_code: next.countryCode,
      modules: next.modules,
      onboarded: next.onboarded,
      vet_sure_member: next.vetSureMember,
      is_admin: Boolean(next.isAdmin),
      notifications_enabled: next.notificationsEnabled !== false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id);

  if (error) throw error;
  cacheSessionProfile(next);
  return next;
}

export async function resetUser(): Promise<void> {
  setSessionAccountId(null);
  setAdminSession(false);
}

export type AccessCodeResult = {
  accountId: string;
  otp: string;
  expiresAt: string;
  isNew: boolean;
  phone: string;
  countryCode: string;
  /** Same device already bound — restore session and skip OTP. */
  skipVerify?: boolean;
  user?: UserProfile;
};

/** Request a unique one-time access code for this phone (no SMS — returned to the client). */
export async function requestAccessCode(phone: string, countryCode = "+263"): Promise<AccessCodeResult> {
  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 6) {
    throw new Error("Enter a valid mobile number.");
  }

  const deviceId = getDeviceId();
  const { data: existing, error: lookupError } = await supabase
    .from("accounts")
    .select("*")
    .eq("phone", cleanPhone)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing?.bound_device_id && String(existing.bound_device_id) !== deviceId) {
    throw new Error(
      "This account is bound to another device. Open Settings on that device and unbind it before logging in here.",
    );
  }

  // Returning user on the same bound device — restore session and skip OTP/onboarding.
  if (existing?.bound_device_id && String(existing.bound_device_id) === deviceId) {
    const user = mapAccount(existing as Record<string, unknown>);
    setSessionAccountId(String(existing.id));
    cacheSessionProfile(user);
    await supabase
      .from("accounts")
      .update({
        otp_code: null,
        otp_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    return {
      accountId: String(existing.id),
      otp: "",
      expiresAt: "",
      isNew: false,
      phone: cleanPhone,
      countryCode,
      skipVerify: true,
      user,
    };
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  if (existing) {
    const { data, error } = await supabase
      .from("accounts")
      .update({
        otp_code: otp,
        otp_expires_at: expiresAt,
        country_code: countryCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return {
      accountId: String(data.id),
      otp,
      expiresAt,
      isNew: false,
      phone: cleanPhone,
      countryCode,
    };
  }

  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      id,
      phone: cleanPhone,
      country_code: countryCode,
      full_name: "",
      modules: [],
      onboarded: false,
      otp_code: otp,
      otp_expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    accountId: String(data.id),
    otp,
    expiresAt,
    isNew: true,
    phone: cleanPhone,
    countryCode,
  };
}

export async function verifyAccessCode(input: {
  accountId: string;
  code: string;
  fullName?: string;
}): Promise<UserProfile> {
  const deviceId = getDeviceId();
  const { data, error } = await supabase.from("accounts").select("*").eq("id", input.accountId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Account not found. Start again from login.");

  if (data.bound_device_id && String(data.bound_device_id) !== deviceId) {
    throw new Error("This account is bound to another device.");
  }

  if (!data.otp_code || String(data.otp_code) !== input.code.trim()) {
    throw new Error("Incorrect access code. Please try again.");
  }

  if (data.otp_expires_at && new Date(String(data.otp_expires_at)).getTime() < Date.now()) {
    throw new Error("Access code expired. Request a new one.");
  }

  const existingName = String(data.full_name ?? "").trim();
  const fullName = (input.fullName ?? existingName).trim() || existingName;
  const { data: updated, error: updateError } = await supabase
    .from("accounts")
    .update({
      full_name: fullName,
      otp_code: null,
      otp_expires_at: null,
      bound_device_id: deviceId,
      device_bound_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.accountId)
    .select("*")
    .single();

  if (updateError) throw updateError;

  const user = mapAccount(updated as Record<string, unknown>);
  setSessionAccountId(String(updated.id));
  cacheSessionProfile(user);
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
  return Boolean(user.id && user.boundDeviceId && user.onboarded && user.phone && user.fullName && user.modules.length);
}

export async function hasActiveSession(): Promise<boolean> {
  const user = await getUser();
  return Boolean(user.id && user.boundDeviceId);
}
