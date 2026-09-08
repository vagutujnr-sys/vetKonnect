import type { AdminUser, AdminVet, AppNotification, CommunityComment, CommunityPost, ModuleId } from "@/types";
import { supabase } from "./supabaseClient";

function mapAccountRow(row: Record<string, unknown>, petCount = 0): AdminUser {
  const accountType = String(row.account_type ?? "owner") === "vet" ? "vet" : "owner";
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    phone: String(row.phone ?? ""),
    country: String(row.country_code ?? "+263"),
    countryCode: String(row.country_code ?? "+263"),
    onboarded: Boolean(row.onboarded),
    pets: petCount,
    petIds: [],
    memberSince: row.created_at ? new Date(String(row.created_at)).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : undefined,
    vetSureMember: Boolean(row.vet_sure_member),
    modules: (row.modules ?? []) as ModuleId[],
    notificationsEnabled: row.notifications_enabled !== false,
    boundDeviceId: row.bound_device_id ? String(row.bound_device_id) : null,
    deviceBoundAt: row.device_bound_at ? String(row.device_bound_at) : null,
    isAdmin: Boolean(row.is_admin),
    accountType,
    vetVerified: Boolean(row.vet_verified),
    practiceName: String(row.practice_name ?? ""),
    patientsServed: Number(row.patients_served ?? 0),
    blocked: Boolean(row.blocked),
    avatarUrl: String(row.avatar_url ?? ""),
  };
}

function mapVetRow(row: Record<string, unknown>): AdminVet {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    surgery: String(row.surgery ?? ""),
    location: String(row.location ?? ""),
    phone: String(row.phone ?? ""),
    status: row.status as AdminVet["status"],
    rating: Number(row.rating ?? 0),
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
    address: row.address ? String(row.address) : undefined,
  };
}

function mapPostRow(row: Record<string, unknown>): CommunityPost {
  return {
    id: String(row.id),
    authorId: row.author_id ? String(row.author_id) : undefined,
    author: String(row.author ?? ""),
    location: String(row.location ?? ""),
    timeAgo: String(row.time_ago ?? ""),
    avatarUrl: String(row.avatar_url ?? ""),
    imageUrl: String(row.image_url ?? ""),
    videoUrl: String(row.video_url ?? ""),
    mediaType: (row.media_type as CommunityPost["mediaType"]) || "none",
    body: String(row.body ?? ""),
    likes: Number(row.likes ?? 0),
    comments: Number(row.comments ?? 0),
    views: Number(row.views ?? 0),
    tag: row.tag as CommunityPost["tag"],
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function mapCommentRow(row: Record<string, unknown>): CommunityComment {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    accountId: String(row.account_id),
    authorName: String(row.author_name ?? ""),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapNotificationRow(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    type: String(row.type ?? "system"),
    read: Boolean(row.read),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

/** App accounts (device-bound login users). */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const [{ data: accounts, error }, { data: pets }] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at", { ascending: false }),
    supabase.from("pets").select("id,owner_id"),
  ]);
  if (error) throw error;

  const petCounts = new Map<string, number>();
  for (const pet of pets ?? []) {
    const ownerId = pet.owner_id ? String(pet.owner_id) : "";
    if (!ownerId) continue;
    petCounts.set(ownerId, (petCounts.get(ownerId) ?? 0) + 1);
  }

  return (accounts ?? []).map((row) => {
    const mapped = mapAccountRow(row as Record<string, unknown>, petCounts.get(String(row.id)) ?? 0);
    mapped.petIds = (pets ?? [])
      .filter((pet) => String(pet.owner_id ?? "") === mapped.id)
      .map((pet) => String(pet.id));
    return mapped;
  });
}

export async function updateAdminUser(id: string, patch: Partial<AdminUser>): Promise<AdminUser | undefined> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.fullName !== undefined) payload.full_name = patch.fullName;
  if (patch.phone !== undefined) payload.phone = patch.phone.replace(/\s+/g, "").trim();
  if (patch.country !== undefined) payload.country_code = patch.country;
  if (patch.countryCode !== undefined) payload.country_code = patch.countryCode;
  if (patch.onboarded !== undefined) payload.onboarded = patch.onboarded;
  if (patch.vetSureMember !== undefined) payload.vet_sure_member = patch.vetSureMember;
  if (patch.notificationsEnabled !== undefined) payload.notifications_enabled = patch.notificationsEnabled;
  if (patch.modules !== undefined) payload.modules = patch.modules;
  if (patch.isAdmin !== undefined) payload.is_admin = patch.isAdmin;
  if (patch.accountType !== undefined) payload.account_type = patch.accountType === "vet" ? "vet" : "owner";
  if (patch.vetVerified !== undefined) payload.vet_verified = patch.vetVerified;
  if (patch.practiceName !== undefined) payload.practice_name = patch.practiceName;
  if (patch.patientsServed !== undefined) payload.patients_served = patch.patientsServed;
  if (patch.blocked !== undefined) payload.blocked = patch.blocked;
  if (patch.boundDeviceId === null) {
    payload.bound_device_id = null;
    payload.device_bound_at = null;
  }

  const { data, error } = await supabase.from("accounts").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return mapAccountRow(data as Record<string, unknown>, patch.pets ?? 0);
}

export async function unbindAdminAccount(id: string): Promise<AdminUser | undefined> {
  return updateAdminUser(id, { boundDeviceId: null });
}

export async function setAdminVetVerified(id: string, verified: boolean): Promise<AdminUser | undefined> {
  return updateAdminUser(id, { accountType: "vet", vetVerified: verified });
}

/** Elevate a vet: verified practice access and ensure they are not blocked. */
export async function elevateAdminVet(id: string): Promise<AdminUser | undefined> {
  return updateAdminUser(id, {
    accountType: "vet",
    vetVerified: true,
    blocked: false,
    onboarded: true,
  });
}

/** Block or unblock an app account from signing in. */
export async function setAdminAccountBlocked(id: string, blocked: boolean): Promise<AdminUser | undefined> {
  if (blocked) {
    return updateAdminUser(id, {
      blocked: true,
      vetVerified: false,
      boundDeviceId: null,
    });
  }
  return updateAdminUser(id, { blocked: false });
}

export async function deleteAdminUser(id: string): Promise<void> {
  await supabase.from("notifications").delete().eq("account_id", id);
  await supabase.from("community_likes").delete().eq("account_id", id);
  await supabase.from("community_comments").delete().eq("account_id", id);
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function getAdminVets(): Promise<AdminVet[]> {
  const { data, error } = await supabase.from("vets").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapVetRow(row as Record<string, unknown>));
}

export async function saveAdminVets(vets: AdminVet[]): Promise<void> {
  const { error } = await supabase.from("vets").upsert(
    vets.map((vet) => ({
      id: vet.id,
      name: vet.name,
      surgery: vet.surgery,
      location: vet.location,
      phone: vet.phone,
      status: vet.status,
      rating: vet.rating,
      latitude: vet.latitude ?? null,
      longitude: vet.longitude ?? null,
      address: vet.address ?? null,
    })),
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function updateAdminVet(id: string, patch: Partial<AdminVet>): Promise<AdminVet | undefined> {
  const { data, error } = await supabase
    .from("vets")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.surgery !== undefined ? { surgery: patch.surgery } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapVetRow(data as Record<string, unknown>);
}

export async function deleteAdminVet(id: string): Promise<void> {
  const { error } = await supabase.from("vets").delete().eq("id", id);
  if (error) throw error;
}

export async function getAdminPosts(): Promise<CommunityPost[]> {
  const { data, error } = await supabase.from("community_posts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapPostRow(row as Record<string, unknown>));
}

export async function updateAdminPost(id: string, patch: Partial<CommunityPost>): Promise<CommunityPost | undefined> {
  const { data, error } = await supabase
    .from("community_posts")
    .update({
      ...(patch.author !== undefined ? { author: patch.author } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.tag !== undefined ? { tag: patch.tag } : {}),
      ...(patch.likes !== undefined ? { likes: patch.likes } : {}),
      ...(patch.comments !== undefined ? { comments: patch.comments } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapPostRow(data as Record<string, unknown>);
}

export async function deleteAdminPost(id: string): Promise<void> {
  await supabase.from("community_likes").delete().eq("post_id", id);
  await supabase.from("community_comments").delete().eq("post_id", id);
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  if (error) throw error;
}

export async function getAdminComments(postId?: string): Promise<CommunityComment[]> {
  let query = supabase.from("community_comments").select("*").order("created_at", { ascending: false });
  if (postId) query = query.eq("post_id", postId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapCommentRow(row as Record<string, unknown>));
}

export async function deleteAdminComment(id: string, postId: string): Promise<void> {
  const { error } = await supabase.from("community_comments").delete().eq("id", id);
  if (error) throw error;
  const { count } = await supabase
    .from("community_comments")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);
  await supabase.from("community_posts").update({ comments: count ?? 0 }).eq("id", postId);
}

export async function getAdminNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => mapNotificationRow(row as Record<string, unknown>));
}

export async function broadcastNotification(input: {
  title: string;
  body: string;
  type?: string;
  accountIds?: string[];
}): Promise<number> {
  let accountIds = input.accountIds;
  if (!accountIds?.length) {
    const { data, error } = await supabase.from("accounts").select("id");
    if (error) throw error;
    accountIds = (data ?? []).map((row) => String(row.id));
  }
  if (!accountIds.length) return 0;

  const rows = accountIds.map((accountId) => ({
    id: crypto.randomUUID(),
    account_id: accountId,
    title: input.title,
    body: input.body,
    type: input.type ?? "notice",
    read: false,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) throw error;
  return rows.length;
}

export async function deleteAdminNotification(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}
