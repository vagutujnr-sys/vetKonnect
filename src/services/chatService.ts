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
