import type { PotentialClient } from "@/types";
import { createNotification } from "./notificationService";
import { supabase } from "./supabaseClient";
import { getUser, updateUser } from "./userService";

/** Owner accounts with pets — treated as potential clients for verified vets. */
export async function getPotentialClients(limit = 40): Promise<PotentialClient[]> {
  const [{ data: accounts, error: accountsError }, { data: pets, error: petsError }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,full_name,phone,created_at,account_type")
      .neq("account_type", "vet")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("pets").select("id,name,owner_id"),
  ]);

  if (accountsError) throw accountsError;
  if (petsError) throw petsError;

  const petsByOwner = new Map<string, string[]>();
  for (const pet of pets ?? []) {
    const ownerId = pet.owner_id ? String(pet.owner_id) : "";
    if (!ownerId) continue;
    const list = petsByOwner.get(ownerId) ?? [];
    list.push(String(pet.name ?? "Pet"));
    petsByOwner.set(ownerId, list);
  }

  return (accounts ?? [])
    .map((row) => {
      const id = String(row.id);
      const petNames = petsByOwner.get(id) ?? [];
      return {
        id,
        fullName: String(row.full_name ?? "").trim() || "Pet owner",
        phone: String(row.phone ?? ""),
        pets: petNames.length,
        petNames,
        memberSince: row.created_at
          ? new Date(String(row.created_at)).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
          : undefined,
      } satisfies PotentialClient;
    })
    .filter((client) => client.pets > 0)
    .slice(0, limit);
}

export async function requestPracticeDashboard(): Promise<void> {
  const user = await getUser();
  if (!user.id) throw new Error("Sign in to request a practice dashboard.");

  await createNotification({
    accountId: user.id,
    title: "Practice dashboard requested",
    body: "Your request was sent to VetKonnect admin. We'll follow up after verification.",
    type: "system",
  });

  await updateUser({
    practiceName: user.practiceName?.trim() || `${user.fullName}'s Practice`,
  });
}
