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

/** Resolve a directory surgery / vet phone to a verified (or any) vet app account. */
export async function resolveVetAccountId(input: {
  surgeryId?: string | null;
  phone?: string | null;
}): Promise<{ accountId: string; fullName: string } | null> {
  if (input.surgeryId) {
    const { data, error } = await supabase
      .from("accounts")
      .select("id, full_name, account_type, vet_verified")
      .eq("surgery_id", input.surgeryId)
      .eq("account_type", "vet")
      .order("vet_verified", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      return { accountId: String(data.id), fullName: String(data.full_name ?? "Veterinarian") };
    }
  }

  const digits = normalizePhone(input.phone);
  if (digits.length >= 7) {
    const { data, error } = await supabase
      .from("accounts")
      .select("id, full_name, phone, country_code, account_type")
      .eq("account_type", "vet");
    if (error) throw error;
    const match = (data ?? []).find((row) => {
      const combined = normalizePhone(`${row.country_code ?? ""}${row.phone ?? ""}`);
      const phoneOnly = normalizePhone(String(row.phone ?? ""));
      return combined.endsWith(digits) || digits.endsWith(phoneOnly) || phoneOnly.endsWith(digits.slice(-9));
    });
    if (match) {
      return { accountId: String(match.id), fullName: String(match.full_name ?? "Veterinarian") };
    }
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
      .select("full_name")
      .eq("id", input.vetAccountId)
      .maybeSingle();
    return mapConversationRow(
      existing as Record<string, unknown>,
      String(peer?.full_name ?? "Veterinarian"),
      "vet",
      0,
    );
  }

  const id = crypto.randomUUID();
  const row = {
    id,
    owner_account_id: ownerId,
    vet_account_id: input.vetAccountId,
    surgery_id: input.surgeryId ?? null,
    last_message_at: new Date().toISOString(),
    last_message_preview: "",
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("conversations").insert(row).select("*").single();
  if (error) throw error;

  const { data: peer } = await supabase
    .from("accounts")
    .select("full_name")
    .eq("id", input.vetAccountId)
    .maybeSingle();

  return mapConversationRow(
    data as Record<string, unknown>,
    String(peer?.full_name ?? "Veterinarian"),
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

  const { data: peers } = await supabase.from("accounts").select("id, full_name, account_type").in("id", peerIds);
  const peerMap = new Map(
    (peers ?? []).map((p) => [String(p.id), { name: String(p.full_name ?? "User"), type: String(p.account_type ?? "") }]),
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

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      conversationId: String(r.conversation_id),
      senderAccountId: String(r.sender_account_id),
      body: String(r.body ?? ""),
      readByRecipient: Boolean(r.read_by_recipient),
      createdAt: String(r.created_at ?? ""),
      mine: String(r.sender_account_id) === accountId,
    };
  });
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

export async function sendChatMessage(conversationId: string, body: string): Promise<ChatMessage> {
  const accountId = getSessionAccountId();
  if (!accountId) throw new Error("You must be signed in to send a message.");

  const text = body.trim();
  if (!text) throw new Error("Message cannot be empty.");

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
  const { data, error } = await supabase
    .from("messages")
    .insert({
      id,
      conversation_id: conversationId,
      sender_account_id: accountId,
      body: text,
      read_by_recipient: false,
      created_at: createdAt,
    })
    .select("*")
    .single();
  if (error) throw error;

  await supabase
    .from("conversations")
    .update({
      last_message_at: createdAt,
      last_message_preview: text.length > 120 ? `${text.slice(0, 117)}…` : text,
    })
    .eq("id", conversationId);

  const recipientId = accountId === ownerId ? vetId : ownerId;
  const { data: sender } = await supabase.from("accounts").select("full_name").eq("id", accountId).maybeSingle();
  const senderName = String(sender?.full_name ?? "VetKonnect user");

  try {
    await createNotification({
      accountId: recipientId,
      title: `Message from ${senderName}`,
      body: text.length > 100 ? `${text.slice(0, 97)}…` : text,
      type: "chat",
    });
  } catch (error) {
    console.warn("Chat notification failed", error);
  }

  return {
    id: String(data.id),
    conversationId,
    senderAccountId: accountId,
    body: text,
    readByRecipient: false,
    createdAt,
    mine: true,
  };
}
