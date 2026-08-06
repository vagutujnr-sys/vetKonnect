import type { UserProfile } from "@/types";
import { readPersisted, writePersisted } from "./storage";

const KEY = "vetconnect.user";

export const ADMIN_PIN = "2026";

export const defaultUser: UserProfile = {
  fullName: "",
  phone: "",
  countryCode: "+263",
  modules: [],
  vetSureMember: false,
  onboarded: false,
  isAdmin: false,
};

export async function getUser(): Promise<UserProfile> {
  return readPersisted<UserProfile>(KEY, defaultUser);
}

export async function updateUser(patch: Partial<UserProfile>): Promise<UserProfile> {
  const current = await readPersisted<UserProfile>(KEY, defaultUser);
  const next = { ...current, ...patch };
  await writePersisted(KEY, next);
  return next;
}

export async function resetUser(): Promise<void> {
  await writePersisted(KEY, defaultUser);
}

/** Mock OTP — always the same demo code, always verifies successfully. */
export const DEMO_OTP = "684291";
export async function requestOtp(_phone: string): Promise<string> {
  return DEMO_OTP;
}
export async function verifyOtp(code: string): Promise<boolean> {
  return code.length === 6;
}
