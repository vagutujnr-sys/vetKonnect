import { mockAdminUsers, mockAdminVets } from "@/data/mockAdmin";
import type { AdminUser, AdminVet } from "@/types";
import { delay, readLocal, writeLocal } from "./storage";

const USERS_KEY = "vetconnect.adminUsers";
const VETS_KEY = "vetconnect.adminVets";

export async function getAdminUsers(): Promise<AdminUser[]> {
  await delay();
  return readLocal<AdminUser[]>(USERS_KEY, mockAdminUsers);
}

export async function saveAdminUsers(users: AdminUser[]): Promise<void> {
  await delay();
  writeLocal(USERS_KEY, users);
}

export async function getAdminVets(): Promise<AdminVet[]> {
  await delay();
  return readLocal<AdminVet[]>(VETS_KEY, mockAdminVets);
}

export async function saveAdminVets(vets: AdminVet[]): Promise<void> {
  await delay();
  writeLocal(VETS_KEY, vets);
}

export async function updateAdminUser(id: string, patch: Partial<AdminUser>): Promise<AdminUser | undefined> {
  const users = await getAdminUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return undefined;
  const updated = { ...users[index], ...patch };
  users[index] = updated;
  await saveAdminUsers(users);
  return updated;
}

export async function deleteAdminUser(id: string): Promise<void> {
  const users = await getAdminUsers();
  await saveAdminUsers(users.filter((user) => user.id !== id));
}

export async function updateAdminVet(id: string, patch: Partial<AdminVet>): Promise<AdminVet | undefined> {
  const vets = await getAdminVets();
  const index = vets.findIndex((vet) => vet.id === id);
  if (index === -1) return undefined;
  const updated = { ...vets[index], ...patch };
  vets[index] = updated;
  await saveAdminVets(vets);
  return updated;
}

export async function deleteAdminVet(id: string): Promise<void> {
  const vets = await getAdminVets();
  await saveAdminVets(vets.filter((vet) => vet.id !== id));
}
