import type { CommunityComment, CommunityPost, MediaType, ServiceListing } from "@/types";
import { getSessionAccountId } from "./userService";
import { createNotification } from "./notificationService";
import { supabase } from "./supabaseClient";

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapPostRow(row: Record<string, unknown>, accountId?: string | null): CommunityPost {
  const likedBy = Array.isArray(row.liked_by) ? (row.liked_by as string[]) : [];
  return {
    id: String(row.id),
    authorId: row.author_id ? String(row.author_id) : undefined,
    author: String(row.author ?? ""),
    location: String(row.location ?? ""),
    timeAgo: row.created_at ? formatTimeAgo(String(row.created_at)) : String(row.time_ago ?? ""),
    avatarUrl: String(row.avatar_url ?? ""),
    imageUrl: String(row.image_url ?? ""),
    videoUrl: String(row.video_url ?? ""),
    mediaType: (row.media_type as MediaType) || (row.image_url ? "image" : "none"),
    body: String(row.body ?? ""),
    likes: Number(row.likes ?? 0),
    comments: Number(row.comments ?? 0),
    views: Number(row.views ?? 0),
    tag: row.tag as CommunityPost["tag"],
    likedByMe: accountId ? likedBy.includes(accountId) : false,
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

function mapServiceRow(row: Record<string, unknown>): ServiceListing {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    category: row.category as ServiceListing["category"],
    distanceKm: Number(row.distance_km ?? 0),
    rating: Number(row.rating ?? 0),
    address: String(row.address ?? ""),
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    open: Boolean(row.open),
    imageUrl: String(row.image_url ?? ""),
  };
}

export async function getPosts(options?: { limit?: number; offset?: number }): Promise<CommunityPost[]> {
  const accountId = getSessionAccountId();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const { data, error } = await supabase
    .from("community_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map((row) => mapPostRow(row as Record<string, unknown>, accountId));
}

export async function getPostById(id: string): Promise<CommunityPost | null> {
  const accountId = getSessionAccountId();
  const { data, error } = await supabase.from("community_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapPostRow(data as Record<string, unknown>, accountId);
}

/** Record a unique view for the current account and notify the author when first read. */
export async function recordPostView(postId: string, viewerName?: string): Promise<CommunityPost | null> {
  const accountId = getSessionAccountId();
  const { data: post, error } = await supabase.from("community_posts").select("*").eq("id", postId).maybeSingle();
  if (error) throw error;
  if (!post) return null;

  if (!accountId) {
    const nextViews = Number(post.views ?? 0) + 1;
    const { data, error: updateError } = await supabase
      .from("community_posts")
      .update({ views: nextViews })
      .eq("id", postId)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return mapPostRow(data as Record<string, unknown>, null);
  }

  const { data: existingView } = await supabase
    .from("community_views")
    .select("id")
    .eq("post_id", postId)
    .eq("account_id", accountId)
    .maybeSingle();

  if (existingView) {
    return mapPostRow(post as Record<string, unknown>, accountId);
  }

  const { error: viewError } = await supabase.from("community_views").insert({
    id: crypto.randomUUID(),
    post_id: postId,
    account_id: accountId,
    created_at: new Date().toISOString(),
  });
  if (viewError && !String(viewError.message).toLowerCase().includes("duplicate")) {
    throw viewError;
  }

  const nextViews = Number(post.views ?? 0) + 1;
  const { data, error: updateError } = await supabase
    .from("community_posts")
    .update({ views: nextViews })
    .eq("id", postId)
    .select("*")
    .single();
  if (updateError) throw updateError;

  if (post.author_id && String(post.author_id) !== accountId) {
    await createNotification({
      accountId: String(post.author_id),
      title: "Someone read your post",
      body: `${viewerName?.trim() || "A VetKonnect member"} viewed your community post.`,
      type: "view",
    });
  }

  return mapPostRow(data as Record<string, unknown>, accountId);
}

export async function uploadCommunityMedia(file: File): Promise<{ url: string; mediaType: MediaType }> {
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    throw new Error("Only images or short videos are supported.");
  }
  if (isVideo && file.size > 40 * 1024 * 1024) {
    throw new Error("Video must be under 40MB.");
  }

  const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
  const path = `${getSessionAccountId() ?? "guest"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("community-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("community-media").getPublicUrl(path);
  return { url: data.publicUrl, mediaType: isVideo ? "video" : "image" };
}

export async function createPost(input: {
  body: string;
  tag: CommunityPost["tag"];
  location?: string;
  authorName: string;
  mediaUrl?: string;
  mediaType?: MediaType;
}): Promise<CommunityPost> {
  const accountId = getSessionAccountId();
  if (!accountId) throw new Error("Log in to post.");

  const mediaType = input.mediaType ?? (input.mediaUrl ? "image" : "none");
  const { data: account } = await supabase.from("accounts").select("avatar_url").eq("id", accountId).maybeSingle();
  const row = {
    id: crypto.randomUUID(),
    author_id: accountId,
    author: input.authorName,
    location: input.location ?? "Zimbabwe",
    time_ago: "Just now",
    avatar_url: String(account?.avatar_url ?? ""),
    image_url: mediaType === "image" ? input.mediaUrl ?? "" : "",
    video_url: mediaType === "video" ? input.mediaUrl ?? "" : "",
    media_type: mediaType,
    body: input.body.trim(),
    likes: 0,
    comments: 0,
    views: 0,
    tag: input.tag,
    liked_by: [],
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("community_posts").insert(row).select("*").single();
  if (error) throw error;

  await createNotification({
    title: "Post shared",
    body: "Your community post is live.",
    type: "community",
  });

  return mapPostRow(data as Record<string, unknown>, accountId);
}

export async function toggleLike(postId: string): Promise<CommunityPost> {
  const accountId = getSessionAccountId();
  if (!accountId) throw new Error("Log in to like posts.");

  const { data: post, error } = await supabase.from("community_posts").select("*").eq("id", postId).single();
  if (error) throw error;

  const likedBy = Array.isArray(post.liked_by) ? ([...post.liked_by] as string[]) : [];
  const alreadyLiked = likedBy.includes(accountId);

  if (alreadyLiked) {
    const nextLikedBy = likedBy.filter((id) => id !== accountId);
    await supabase.from("community_likes").delete().eq("post_id", postId).eq("account_id", accountId);
    const { data, error: updateError } = await supabase
      .from("community_posts")
      .update({ liked_by: nextLikedBy, likes: Math.max(0, Number(post.likes ?? 0) - 1) })
      .eq("id", postId)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return mapPostRow(data as Record<string, unknown>, accountId);
  }

  await supabase.from("community_likes").upsert(
    { id: crypto.randomUUID(), post_id: postId, account_id: accountId },
    { onConflict: "post_id,account_id" },
  );
  const nextLikedBy = [...likedBy, accountId];
  const { data, error: updateError } = await supabase
    .from("community_posts")
    .update({ liked_by: nextLikedBy, likes: Number(post.likes ?? 0) + 1 })
    .eq("id", postId)
    .select("*")
    .single();
  if (updateError) throw updateError;

  if (post.author_id && String(post.author_id) !== accountId) {
    await createNotification({
      accountId: String(post.author_id),
      title: "New like",
      body: "Someone liked your community post.",
      type: "like",
    });
  }

  return mapPostRow(data as Record<string, unknown>, accountId);
}

export async function getComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapCommentRow(row as Record<string, unknown>));
}

export async function addComment(postId: string, body: string, authorName: string): Promise<CommunityComment> {
  const accountId = getSessionAccountId();
  if (!accountId) throw new Error("Log in to comment.");
  const text = body.trim();
  if (!text) throw new Error("Comment cannot be empty.");

  const row = {
    id: crypto.randomUUID(),
    post_id: postId,
    account_id: accountId,
    author_name: authorName,
    body: text,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("community_comments").insert(row).select("*").single();
  if (error) throw error;

  const { data: post } = await supabase.from("community_posts").select("comments,author_id").eq("id", postId).maybeSingle();
  if (post) {
    await supabase
      .from("community_posts")
      .update({ comments: Number(post.comments ?? 0) + 1 })
      .eq("id", postId);

    if (post.author_id && String(post.author_id) !== accountId) {
      await createNotification({
        accountId: String(post.author_id),
        title: "New comment",
        body: `${authorName} commented on your post.`,
        type: "comment",
      });
    }
  }

  return mapCommentRow(data as Record<string, unknown>);
}

export async function getServices(): Promise<ServiceListing[]> {
  const { data, error } = await supabase.from("services").select("*").order("distance_km", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => mapServiceRow(row as Record<string, unknown>));
}

export async function saveServices(services: ServiceListing[]): Promise<void> {
  const { error } = await supabase.from("services").upsert(
    services.map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      distance_km: service.distanceKm,
      rating: service.rating,
      address: service.address,
      latitude: service.latitude,
      longitude: service.longitude,
      open: service.open,
      image_url: service.imageUrl,
    })),
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function updateService(id: string, patch: Partial<ServiceListing>): Promise<ServiceListing | undefined> {
  const services = await getServices();
  const index = services.findIndex((service) => service.id === id);
  if (index === -1) return undefined;
  const updated = { ...services[index], ...patch };
  services[index] = updated;
  await saveServices(services);
  return updated;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}

// Kept for admin compatibility
export async function savePosts(posts: CommunityPost[]): Promise<void> {
  const { error } = await supabase.from("community_posts").upsert(
    posts.map((post) => ({
      id: post.id,
      author: post.author,
      author_id: post.authorId ?? null,
      location: post.location,
      time_ago: post.timeAgo,
      avatar_url: post.avatarUrl,
      image_url: post.imageUrl,
      video_url: post.videoUrl ?? "",
      media_type: post.mediaType ?? "image",
      body: post.body,
      likes: post.likes,
      comments: post.comments,
      tag: post.tag,
    })),
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function updatePost(id: string, patch: Partial<CommunityPost>): Promise<CommunityPost | undefined> {
  const posts = await getPosts();
  const index = posts.findIndex((post) => post.id === id);
  if (index === -1) return undefined;
  const updated = { ...posts[index], ...patch };
  posts[index] = updated;
  await savePosts(posts);
  return updated;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  if (error) throw error;
}
