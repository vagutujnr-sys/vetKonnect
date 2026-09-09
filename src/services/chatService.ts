import type { ChatConversation, ChatMessage } from "@/types";
import { createNotification } from "@/services/notificationService";
import { getSessionAccountId } from "@/services/userService";
import { supabase } from "@/services/supabaseClient";

function normalizePhone(value?: string | null): string {
  return String(value ?? "").replace(/\D/g, "");
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return error.code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

function mapConversationRow(
  row: Record<string, unknown>,
  peerName: string,
  peerRole: "owner" | "vet",
  unreadCount: number,
): ChatConversation {
  return {
    id: String(row.id),
    ownerAccountId: String(row.owner_account_id),
    vetAccountId: String(row.vet_account_id),
    surgeryId: row.surgery_id ? String(row.surgery_id) : null,
    lastMessageAt: String(row.last_message_at ?? row.created_at ?? ""),
    lastMessagePreview: String(row.last_message_preview ?? ""),
    createdAt: String(row.created_at ?? ""),
    peerName,
    peerRole,
    unreadCount,
  };
}

function phonesMatch(a?: string | null, b?: string | null): boolean {
  const left = normalizePhone(a);
  const right = normalizePhone(b);
  if (left.length < 7 || right.length < 7) return false;
  return left.endsWith(right) || right.endsWith(left) || left.endsWith(right.slice(-9)) || right.endsWith(left.slice(-9));
}

function normalizeName(value?: string | null): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesLooselyMatch(a?: string | null, b?: string | null): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

type VetAccountRow = {
  id: string;
  full_name?: string | null;
  practice_name?: string | null;
  phone?: string | null;
  country_code?: string | null;
  surgery_id?: string | null;
  vet_verified?: boolean | null;
};

function pickBestVetAccount(rows: VetAccountRow[]): VetAccountRow | null {
  if (!rows.length) return null;
  return [...rows].sort((a, b) => Number(Boolean(b.vet_verified)) - Number(Boolean(a.vet_verified)))[0] ?? null;
}

function toResolved(row: VetAccountRow): { accountId: string; fullName: string } {
  return {
    accountId: String(row.id),
    fullName: String(row.full_name || row.practice_name || "Veterinarian"),
  };
}

/** Resolve a Map Vets / directory clinic to a VetKonnect vet account. */
export async function resolveVetAccountId(input: {
  surgeryId?: string | null;
  phone?: string | null;
  /** Clinic / surgery display names from Map Vets (helps when surgery_id was never saved). */
  name?: string | null;
  surgery?: string | null;
}): Promise<{ accountId: string; fullName: string } | null> {
  const nameHints = [input.name, input.surgery].map(normalizeName).filter(Boolean);
  const phoneHints = [input.phone].filter(Boolean) as string[];
  const directoryIds = new Set<string>();
  if (input.surgeryId) directoryIds.add(String(input.surgeryId));

  if (input.surgeryId) {
    // Direct FK link (preferred).
    const { data, error } = await supabase
      .from("accounts")
      .select("id, full_name, practice_name, phone, country_code, surgery_id, vet_verified, account_type")
      .eq("surgery_id", input.surgeryId)
      .eq("account_type", "vet")
      .order("vet_verified", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) return toResolved(data as VetAccountRow);

    // Map pin may be a services.id — resolve the clinic name, then find matching vets row(s).
    const [{ data: vetRow }, { data: serviceRow }] = await Promise.all([
      supabase.from("vets").select("id, name, surgery, phone").eq("id", input.surgeryId).maybeSingle(),
      supabase.from("services").select("id, name, phone").eq("id", input.surgeryId).maybeSingle(),
    ]);

    if (vetRow) {
      directoryIds.add(String(vetRow.id));
      if (vetRow.phone) phoneHints.push(String(vetRow.phone));
      for (const hint of [vetRow.surgery, vetRow.name]) {
        const n = normalizeName(hint);
        if (n) nameHints.push(n);
      }
    }

    if (serviceRow) {
      if (serviceRow.phone) phoneHints.push(String(serviceRow.phone));
      const serviceName = normalizeName(serviceRow.name);
      if (serviceName) nameHints.push(serviceName);

      const { data: matchingVets } = await supabase.from("vets").select("id, name, surgery, phone");
      for (const row of matchingVets ?? []) {
        if (
          namesLooselyMatch(String(row.name ?? ""), String(serviceRow.name ?? "")) ||
          namesLooselyMatch(String(row.surgery ?? ""), String(serviceRow.name ?? ""))
        ) {
          directoryIds.add(String(row.id));
          if (row.phone) phoneHints.push(String(row.phone));
          for (const hint of [row.surgery, row.name]) {
            const n = normalizeName(hint);
            if (n) nameHints.push(n);
          }
        }
      }
    }
  }

  const { data: vetAccounts, error: vetAccountsError } = await supabase
    .from("accounts")
    .select("id, full_name, practice_name, phone, country_code, surgery_id, vet_verified, account_type")
    .eq("account_type", "vet");
  if (vetAccountsError) throw vetAccountsError;

  const accounts = (vetAccounts ?? []) as VetAccountRow[];

  // Linked via surgery_id to any directory id we discovered (including remapped services → vets).
  const bySurgeryId = pickBestVetAccount(
    accounts.filter((row) => row.surgery_id && directoryIds.has(String(row.surgery_id))),
  );
  if (bySurgeryId) return toResolved(bySurgeryId);

  // Many vets are “associated” only by practice_name (Profile shows linked without surgery_id).
  const uniqueHints = [...new Set(nameHints)];
  if (uniqueHints.length) {
    const byPracticeName = pickBestVetAccount(
      accounts.filter((row) => uniqueHints.some((hint) => namesLooselyMatch(row.practice_name, hint) || namesLooselyMatch(row.full_name, hint))),
    );
    if (byPracticeName) return toResolved(byPracticeName);
  }

  // Phone match against directory / map phone and account phone (with country code).
  const uniquePhones = [...new Set(phoneHints.map((p) => normalizePhone(p)).filter((p) => p.length >= 7))];
  if (uniquePhones.length) {
    const byPhone = pickBestVetAccount(
      accounts.filter((row) => {
        const combined = normalizePhone(`${row.country_code ?? ""}${row.phone ?? ""}`);
        const phoneOnly = normalizePhone(row.phone);
        return uniquePhones.some(
          (digits) =>
            phonesMatch(combined, digits) ||
            phonesMatch(phoneOnly, digits) ||
            combined.endsWith(digits) ||
            digits.endsWith(phoneOnly),
        );
      }),
    );
    if (byPhone) return toResolved(byPhone);
  }

  return null;
}

export async function getOrCreateConversationWithVet(input: {
  vetAccountId: string;
  surgeryId?: string | null;
}): Promise<ChatConversation> {
  const ownerId = getSessionAccountId();
  if (!ownerId) throw new Error("Sign in as an owner to message a vet.");

  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("*")
    .eq("owner_account_id", ownerId)
    .eq("vet_account_id", input.vetAccountId)
    .maybeSingle();

  if (existingError) {
    if (isMissingRelation(existingError)) {
      throw new Error("Chat is not set up yet. Apply migration 013_owner_vet_chat.sql in Supabase.");
    }
    throw existingError;
  }

  if (existing) {
    const { data: peer } = await supabase
      .from("accounts")
      .select("full_name, practice_name")
      .eq("id", input.vetAccountId)
      .maybeSingle();
    return mapConversationRow(
      existing as Record<string, unknown>,
      String(peer?.practice_name || peer?.full_name || "Veterinarian"),
      "vet",
      0,
    );
  }

  const id = crypto.randomUUID();
  let surgeryId: string | null = input.surgeryId ?? null;
  if (surgeryId) {
    const { data: vetRow } = await supabase.from("vets").select("id").eq("id", surgeryId).maybeSingle();
    if (!vetRow) surgeryId = null;
  }

  const row = {
    id,
    owner_account_id: ownerId,
    vet_account_id: input.vetAccountId,
    surgery_id: surgeryId,
    last_message_at: new Date().toISOString(),
    last_message_preview: "",
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("conversations").insert(row).select("*").single();
  if (error) throw error;

  const { data: peer } = await supabase
    .from("accounts")
    .select("full_name, practice_name")
    .eq("id", input.vetAccountId)
    .maybeSingle();

  return mapConversationRow(
    data as Record<string, unknown>,
    String(peer?.practice_name || peer?.full_name || "Veterinarian"),
    "vet",
    0,
  );
}

export async function listConversations(): Promise<ChatConversation[]> {
  const accountId = getSessionAccountId();
  if (!accountId) return [];

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`owner_account_id.eq.${accountId},vet_account_id.eq.${accountId}`)
    .order("last_message_at", { ascending: false });

  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  if (!rows.length) return [];

  const peerIds = [
    ...new Set(
      rows.map((row) =>
        String(row.owner_account_id) === accountId ? String(row.vet_account_id) : String(row.owner_account_id),
      ),
    ),
  ];

  const { data: peers } = await supabase
    .from("accounts")
    .select("id, full_name, practice_name, account_type")
    .in("id", peerIds);
  const peerMap = new Map(
    (peers ?? []).map((p) => [
      String(p.id),
      {
        name: String(p.practice_name || p.full_name || "User"),
        type: String(p.account_type ?? ""),
      },
    ]),
  );

  const conversationIds = rows.map((r) => String(r.id));
  const { data: unreadRows } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .eq("read_by_recipient", false)
    .neq("sender_account_id", accountId);

  const unreadMap = new Map<string, number>();
  for (const row of unreadRows ?? []) {
    const cid = String(row.conversation_id);
    unreadMap.set(cid, (unreadMap.get(cid) ?? 0) + 1);
  }

  return rows.map((row) => {
    const isOwner = String(row.owner_account_id) === accountId;
    const peerId = isOwner ? String(row.vet_account_id) : String(row.owner_account_id);
    const peer = peerMap.get(peerId);
    return mapConversationRow(
      row,
      peer?.name ?? (isOwner ? "Veterinarian" : "Pet owner"),
      isOwner ? "vet" : "owner",
      unreadMap.get(String(row.id)) ?? 0,
    );
  });
}

export async function countUnreadChats(): Promise<number> {
  const conversations = await listConversations();
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

export async function getConversationById(id: string): Promise<ChatConversation | null> {
  const list = await listConversations();
  return list.find((c) => c.id === id) ?? null;
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const accountId = getSessionAccountId();
  if (!accountId) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => mapMessage(row as Record<string, unknown>, accountId));
}

function mapMessage(row: Record<string, unknown>, accountId: string): ChatMessage {
  const mediaTypeRaw = String(row.media_type ?? "none");
  const mediaType =
    mediaTypeRaw === "image" || mediaTypeRaw === "video" || mediaTypeRaw === "audio"
      ? mediaTypeRaw
      : "none";
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderAccountId: String(row.sender_account_id),
    body: String(row.body ?? ""),
    mediaUrl: row.media_url ? String(row.media_url) : null,
    mediaType,
    replyToId: row.reply_to_id ? String(row.reply_to_id) : null,
    replyPreview: row.reply_preview ? String(row.reply_preview) : null,
    replySenderName: row.reply_sender_name ? String(row.reply_sender_name) : null,
    readByRecipient: Boolean(row.read_by_recipient),
    createdAt: String(row.created_at ?? ""),
    mine: String(row.sender_account_id) === accountId,
  };
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const accountId = getSessionAccountId();
  if (!accountId) return;

  await supabase
    .from("messages")
    .update({ read_by_recipient: true })
    .eq("conversation_id", conversationId)
    .eq("read_by_recipient", false)
    .neq("sender_account_id", accountId);
}

export type ChatMediaType = "image" | "video" | "audio";

export async function uploadChatMedia(file: File): Promise<{ url: string; mediaType: ChatMediaType }> {
  const isAudio = file.type.startsWith("audio/");
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isAudio && !isVideo && !isImage) {
    throw new Error("Only images, videos, or audio files are supported.");
  }
  if (file.size > 40 * 1024 * 1024) {
    throw new Error("File must be under 40MB.");
  }

  const mediaType: ChatMediaType = isAudio ? "audio" : isVideo ? "video" : "image";
  const ext =
    file.name.split(".").pop()?.toLowerCase() ||
    (isAudio ? "webm" : isVideo ? "mp4" : "jpg");
  const accountId = getSessionAccountId() ?? "guest";
  const path = `${accountId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from("chat-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) {
    // Fallback if migration 016 bucket is not applied yet.
    if (String(error.message ?? "").toLowerCase().includes("bucket") || error.message?.includes("not found")) {
      const { error: fallbackError } = await supabase.storage.from("community-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (fallbackError) throw fallbackError;
      const { data } = supabase.storage.from("community-media").getPublicUrl(path);
      return { url: data.publicUrl, mediaType };
    }
    throw error;
  }

  const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
  return { url: data.publicUrl, mediaType };
}

export async function sendChatMessage(
  conversationId: string,
  body: string,
  media?: { url: string; mediaType: ChatMediaType } | null,
  replyTo?: ChatMessage | null,
): Promise<ChatMessage> {
  const accountId = getSessionAccountId();
  if (!accountId) throw new Error("You must be signed in to send a message.");

  const text = body.trim();
  if (!text && !media?.url) throw new Error("Add a message or attach media.");

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (convError) throw convError;
  if (!conversation) throw new Error("Conversation not found.");

  const ownerId = String(conversation.owner_account_id);
  const vetId = String(conversation.vet_account_id);
  if (accountId !== ownerId && accountId !== vetId) {
    throw new Error("You are not part of this conversation.");
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const mediaType = media?.mediaType ?? "none";
  const mediaUrl = media?.url ?? null;
  const replyPreview =
    replyTo == null
      ? null
      : replyTo.body.trim() ||
        (replyTo.mediaType === "image"
          ? "Photo"
          : replyTo.mediaType === "video"
            ? "Video"
            : replyTo.mediaType === "audio"
              ? "Voice message"
              : "Message");

  const insertRow: Record<string, unknown> = {
    id,
    conversation_id: conversationId,
    sender_account_id: accountId,
    body: text,
    read_by_recipient: false,
    created_at: createdAt,
    media_url: mediaUrl,
    media_type: mediaType,
    reply_to_id: replyTo?.id ?? null,
    reply_preview: replyPreview,
    reply_sender_name: replyTo ? (replyTo.mine ? "You" : "Them") : null,
  };

  // Prefer peer display name for reply attribution when available from accounts.
  if (replyTo) {
    const { data: replySender } = await supabase
      .from("accounts")
      .select("full_name, practice_name")
      .eq("id", replyTo.senderAccountId)
      .maybeSingle();
    insertRow.reply_sender_name = String(
      replySender?.practice_name || replySender?.full_name || (replyTo.mine ? "You" : "Chat"),
    );
  }

  let { data, error } = await supabase.from("messages").insert(insertRow).select("*").single();

  // Retry without newer columns if migrations 016/017 are not applied.
  if (
    error &&
    (String(error.message ?? "").includes("media_") ||
      String(error.message ?? "").includes("reply_") ||
      error.code === "PGRST204")
  ) {
    if (!text && media?.url) {
      throw new Error("Media chat needs migration 016_chat_media.sql applied in Supabase.");
    }
    const baseRow: Record<string, unknown> = {
      id,
      conversation_id: conversationId,
      sender_account_id: accountId,
      body: text || replyPreview || "Message",
      read_by_recipient: false,
      created_at: createdAt,
    };
    if (mediaUrl) {
      baseRow.media_url = mediaUrl;
      baseRow.media_type = mediaType;
    }
    const retry = await supabase.from("messages").insert(baseRow).select("*").single();
    data = retry.data;
    error = retry.error;
    if (error && (String(error.message ?? "").includes("media_") || error.code === "PGRST204")) {
      const plain = await supabase
        .from("messages")
        .insert({
          id,
          conversation_id: conversationId,
          sender_account_id: accountId,
          body: text || "Message",
          read_by_recipient: false,
          created_at: createdAt,
        })
        .select("*")
        .single();
      data = plain.data;
      error = plain.error;
    }
  }
  if (error) throw error;

  const preview =
    text ||
    (mediaType === "image"
      ? "📷 Photo"
      : mediaType === "video"
        ? "🎬 Video"
        : mediaType === "audio"
          ? "🎤 Voice message"
          : "");

  await supabase
    .from("conversations")
    .update({
      last_message_at: createdAt,
      last_message_preview: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview,
    })
    .eq("id", conversationId);

  const recipientId = accountId === ownerId ? vetId : ownerId;
  const { data: sender } = await supabase
    .from("accounts")
    .select("full_name, avatar_url")
    .eq("id", accountId)
    .maybeSingle();
  const senderName = String(sender?.full_name ?? "VetKonnect user");

  try {
    await createNotification({
      accountId: recipientId,
      title: `Message from ${senderName}`,
      body: preview.length > 100 ? `${preview.slice(0, 97)}…` : preview,
      type: "chat",
      actorAccountId: accountId,
      imageUrl: sender?.avatar_url ? String(sender.avatar_url) : null,
    });
  } catch (notifyError) {
    console.warn("Chat notification failed", notifyError);
  }

  return mapMessage(data as Record<string, unknown>, accountId);
}
