import type { RealtimeChannel } from "@supabase/supabase-js";
import { createNotification } from "@/services/notificationService";
import { getSessionAccountId } from "@/services/userService";
import { supabase } from "@/services/supabaseClient";

export type CallStatus = "ringing" | "accepted" | "active" | "ended" | "rejected" | "missed";

export type CallSession = {
  id: string;
  callerAccountId: string;
  calleeAccountId: string;
  surgeryId?: string | null;
  status: CallStatus;
  createdAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  peerName: string;
  amCaller: boolean;
};

export type CallSignal =
  | { type: "ready"; from: string }
  | { type: "offer"; from: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; candidate: RTCIceCandidateInit }
  | { type: "hangup"; from: string };

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return error.code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

function mapCall(row: Record<string, unknown>, peerName: string, me: string): CallSession {
  const callerAccountId = String(row.caller_account_id);
  return {
    id: String(row.id),
    callerAccountId,
    calleeAccountId: String(row.callee_account_id),
    surgeryId: row.surgery_id ? String(row.surgery_id) : null,
    status: (row.status as CallStatus) || "ringing",
    createdAt: String(row.created_at ?? ""),
    answeredAt: row.answered_at ? String(row.answered_at) : null,
    endedAt: row.ended_at ? String(row.ended_at) : null,
    peerName,
    amCaller: callerAccountId === me,
  };
}

async function peerNameFor(accountId: string): Promise<string> {
  const { data } = await supabase.from("accounts").select("full_name, practice_name").eq("id", accountId).maybeSingle();
  return String(data?.practice_name || data?.full_name || "VetKonnect user");
}

export async function getCallSession(callId: string): Promise<CallSession | null> {
  const me = getSessionAccountId();
  if (!me) return null;
  const { data, error } = await supabase.from("call_sessions").select("*").eq("id", callId).maybeSingle();
  if (error) {
    if (isMissingRelation(error)) throw new Error("Calls are not set up yet. Apply migration 014_in_app_calls.sql.");
    throw error;
  }
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const peerId = String(row.caller_account_id) === me ? String(row.callee_account_id) : String(row.caller_account_id);
  return mapCall(row, await peerNameFor(peerId), me);
}

/** Owner (or either party) starts an in-app voice call — number never shown. */
export async function startInAppCall(input: {
  /** @deprecated Prefer calleeAccountId */
  vetAccountId?: string;
  calleeAccountId?: string;
  surgeryId?: string | null;
}): Promise<CallSession> {
  const callerId = getSessionAccountId();
  if (!callerId) throw new Error("Sign in to place a call.");
  const calleeId = input.calleeAccountId ?? input.vetAccountId;
  if (!calleeId) throw new Error("Missing call recipient.");
  if (callerId === calleeId) throw new Error("You cannot call yourself.");

  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from("call_sessions")
    .insert({
      id,
      caller_account_id: callerId,
      callee_account_id: calleeId,
      surgery_id: input.surgeryId ?? null,
      status: "ringing",
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingRelation(error)) throw new Error("Calls are not set up yet. Apply migration 014_in_app_calls.sql in Supabase.");
    // surgery_id may point at a services row — retry without it.
    if (String(error.message ?? "").toLowerCase().includes("surgery_id") || error.code === "23503") {
      const retry = await supabase
        .from("call_sessions")
        .insert({
          id,
          caller_account_id: callerId,
          callee_account_id: calleeId,
          surgery_id: null,
          status: "ringing",
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (retry.error) throw retry.error;
      const peerName = await peerNameFor(calleeId);
      const { data: caller } = await supabase
        .from("accounts")
        .select("full_name, avatar_url")
        .eq("id", callerId)
        .maybeSingle();
      try {
        await createNotification({
          accountId: calleeId,
          title: "Incoming VetKonnect call",
          body: `${String(caller?.full_name ?? "Someone")} is calling you in the app.`,
          type: "call",
          actorAccountId: callerId,
          imageUrl: caller?.avatar_url ? String(caller.avatar_url) : null,
        });
      } catch (notifyError) {
        console.warn("Call notification failed", notifyError);
      }
      return mapCall(retry.data as Record<string, unknown>, peerName, callerId);
    }
    throw error;
  }

  const peerName = await peerNameFor(calleeId);
  const { data: caller } = await supabase
    .from("accounts")
    .select("full_name, avatar_url")
    .eq("id", callerId)
    .maybeSingle();
  try {
    await createNotification({
      accountId: calleeId,
      title: "Incoming VetKonnect call",
      body: `${String(caller?.full_name ?? "A pet owner")} is calling you in the app.`,
      type: "call",
      actorAccountId: callerId,
      imageUrl: caller?.avatar_url ? String(caller.avatar_url) : null,
    });
  } catch (notifyError) {
    console.warn("Call notification failed", notifyError);
  }

  return mapCall(data as Record<string, unknown>, peerName, callerId);
}

export async function acceptCall(callId: string): Promise<CallSession> {
  const me = getSessionAccountId();
  if (!me) throw new Error("Sign in to answer.");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("call_sessions")
    .update({ status: "accepted", answered_at: now })
    .eq("id", callId)
    .eq("callee_account_id", me)
    .eq("status", "ringing")
    .select("*")
    .single();
  if (error) throw error;
  const peerId = String((data as Record<string, unknown>).caller_account_id);
  return mapCall(data as Record<string, unknown>, await peerNameFor(peerId), me);
}

export async function rejectCall(callId: string): Promise<void> {
  const me = getSessionAccountId();
  if (!me) return;
  await supabase
    .from("call_sessions")
    .update({ status: "rejected", ended_at: new Date().toISOString() })
    .eq("id", callId)
    .eq("callee_account_id", me)
    .eq("status", "ringing");
}

export async function endCall(callId: string): Promise<void> {
  const me = getSessionAccountId();
  if (!me) return;
  await supabase
    .from("call_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", callId)
    .or(`caller_account_id.eq.${me},callee_account_id.eq.${me}`);
}

export async function markCallActive(callId: string): Promise<void> {
  await supabase.from("call_sessions").update({ status: "active" }).eq("id", callId).in("status", ["accepted", "ringing"]);
}

export async function listRingingCallsForMe(): Promise<CallSession[]> {
  const me = getSessionAccountId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("call_sessions")
    .select("*")
    .eq("callee_account_id", me)
    .eq("status", "ringing")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  return Promise.all(
    rows.map(async (row) => mapCall(row, await peerNameFor(String(row.caller_account_id)), me)),
  );
}

/** Recent in-app calls for the signed-in user (caller or callee). */
export async function listCallHistory(limit = 40): Promise<CallSession[]> {
  const me = getSessionAccountId();
  if (!me) return [];
  const { data, error } = await supabase
    .from("call_sessions")
    .select("*")
    .or(`caller_account_id.eq.${me},callee_account_id.eq.${me}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingRelation(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  return Promise.all(
    rows.map(async (row) => {
      const peerId =
        String(row.caller_account_id) === me ? String(row.callee_account_id) : String(row.caller_account_id);
      return mapCall(row, await peerNameFor(peerId), me);
    }),
  );
}

export function subscribeCallSignals(
  callId: string,
  onSignal: (signal: CallSignal) => void,
): RealtimeChannel {
  const channel = supabase.channel(`call-signal:${callId}`, {
    config: { broadcast: { self: false } },
  });
  channel
    .on("broadcast", { event: "signal" }, ({ payload }) => {
      onSignal(payload as CallSignal);
    })
    .subscribe();
  return channel;
}

export async function sendCallSignal(channel: RealtimeChannel, signal: CallSignal): Promise<void> {
  await channel.send({
    type: "broadcast",
    event: "signal",
    payload: signal,
  });
}

export const CALL_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];
