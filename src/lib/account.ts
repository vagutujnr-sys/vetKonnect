import type { UserProfile } from "@/types";

export function isVetAccount(user: Pick<UserProfile, "accountType"> | null | undefined): boolean {
  return user?.accountType === "vet";
}

export function isBreedersClubActive(
  user: Pick<UserProfile, "breedersClubMember" | "breedersClubStatus"> | null | undefined,
): boolean {
  return Boolean(user?.breedersClubMember && user?.breedersClubStatus === "active");
}

export function getAppHomePath(user: UserProfile): "/vet" | "/patients" | "/home" | "/modules" {
  if (isVetAccount(user)) {
    return user.onboarded ? "/vet" : "/modules";
  }
  if (user.onboarded && user.modules.length) return "/home";
  return "/modules";
}

export function isAppReadyUser(user: UserProfile): boolean {
  if (!user.id || !user.phone || !user.fullName) return false;
  if (user.blocked) return false;
  if (isVetAccount(user)) return Boolean(user.onboarded);
  return Boolean(user.onboarded && user.modules.length);
}
