import type { UserProfile } from "@/types";

export function isVetAccount(user: Pick<UserProfile, "accountType"> | null | undefined): boolean {
  return user?.accountType === "vet";
}

export function getAppHomePath(user: UserProfile): "/patients" | "/home" | "/modules" {
  if (isVetAccount(user)) {
    return user.onboarded ? "/patients" : "/modules";
  }
  if (user.onboarded && user.modules.length) return "/home";
  return "/modules";
}

export function isAppReadyUser(user: UserProfile): boolean {
  if (!user.id || !user.boundDeviceId || !user.phone || !user.fullName) return false;
  if (isVetAccount(user)) return Boolean(user.onboarded);
  return Boolean(user.onboarded && user.modules.length);
}
