import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, Mic, Phone, Send, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { startInAppCall } from "@/services/callService";
import {
  getConversationById,
  listMessages,
  markConversationRead,
  sendChatMessage,
  uploadChatMedia,
  type ChatMediaType,
} from "@/services/chatService";
import { supabase } from "@/services/supabaseClient";
import { getSessionAccountId } from "@/services/userService";
import type { ChatConversation, ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chats_/$conversationId")({
  head: () => ({
    meta: [{ title: "Chat — VetKonnect" }],
  }),
  component: ChatThread,
});

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function MessageBody({ message }: { message: ChatMessage }) {
  const mediaType = message.mediaType ?? "none";
  return (
    <>
      {mediaType === "image" && message.mediaUrl ? (
        <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="mb-2 block overflow-hidden rounded-xl">
          <img src={message.mediaUrl} alt="" className="max-h-64 w-full object-cover" loading="lazy" />
        </a>
      ) : null}
      {mediaType === "video" && message.mediaUrl ? (
        <video src={message.mediaUrl} controls playsInline className="mb-2 max-h-64 w-full rounded-xl bg-black" />
      ) : null}
      {mediaType === "audio" && message.mediaUrl ? (
        <audio src={message.mediaUrl} controls className="mb-2 w-full max-w-[240px]" />
      ) : null}
      {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
    </>
  );
}

function ChatThread() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<ChatMediaType | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);

  const mergeMessages = (incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const map = new Map<string, ChatMessage>();
      for (const msg of prev) map.set(msg.id, msg);
      for (const msg of incoming) map.set(msg.id, msg);
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  };

  const clearPending = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
    setPendingKind(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const load = async () => {
    const conv = await getConversationById(conversationId);
    if (!conv) {
      toast.error("Chat not found");
      void navigate({ to: "/chats" });
      return;
    }
    setConversation(conv);
    const msgs = await listMessages(conversationId);
    mergeMessages(msgs);
    await markConversationRead(conversationId);
  };

  useEffect(() => {
    void load().catch((error) => {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not open chat");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const me = getSessionAccountId();
          const mediaTypeRaw = String(row.media_type ?? "none");
          const mapped: ChatMessage = {
            id: String(row.id),
            conversationId: String(row.conversation_id),
            senderAccountId: String(row.sender_account_id),
            body: String(row.body ?? ""),
            mediaUrl: row.media_url ? String(row.media_url) : null,
            mediaType:
              mediaTypeRaw === "image" || mediaTypeRaw === "video" || mediaTypeRaw === "audio"
                ? mediaTypeRaw
                : "none",
            readByRecipient: Boolean(row.read_by_recipient),
            createdAt: String(row.created_at ?? ""),
            mine: String(row.sender_account_id) === me,
          };
          mergeMessages([mapped]);
          if (!mapped.mine) void markConversationRead(conversationId);
        },
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void listMessages(conversationId).then(mergeMessages).catch(() => undefined);
    }, 12000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const attachFile = (file: File | null) => {
    if (!file) return;
    const kind: ChatMediaType | null = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : null;
    if (!kind) {
      toast.error("Choose an image, video, or audio file.");
      return;
    }
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingKind(kind);
    setPendingPreview(URL.createObjectURL(file));
  };

  const startRecording = async () => {
    if (recording || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        const blobType = recorder.mimeType || "audio/webm";
        const blob = new Blob(recordChunksRef.current, { type: blobType });
        const ext = blobType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blobType });
        attachFile(file);
        setRecording(false);
        setRecordSecs(0);
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
      };
      recorder.start();
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone permission is required for voice messages.");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const send = async () => {
    if (busy || recording) return;
    if (!draft.trim() && !pendingFile) return;
    setBusy(true);
    const text = draft;
    const file = pendingFile;
    setDraft("");
    try {
      let media: { url: string; mediaType: ChatMediaType } | null = null;
      if (file) {
        media = await uploadChatMedia(file);
      }
      clearPending();
      const message = await sendChatMessage(conversationId, text, media);
      mergeMessages([message]);
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              lastMessagePreview:
                message.body ||
                (message.mediaType === "image"
                  ? "📷 Photo"
                  : message.mediaType === "video"
                    ? "🎬 Video"
                    : message.mediaType === "audio"
                      ? "🎤 Voice message"
                      : ""),
              lastMessageAt: message.createdAt,
            }
          : prev,
      );
      composerRef.current?.focus();
    } catch (error) {
      setDraft(text);
      toast.error(error instanceof Error ? error.message : "Could not send");
    } finally {
      setBusy(false);
    }
  };

  const callPeer = async () => {
    if (!conversation) return;
    const me = getSessionAccountId();
    if (!me) return;
    const peerId =
      conversation.ownerAccountId === me ? conversation.vetAccountId : conversation.ownerAccountId;
    setCalling(true);
    try {
      const call = await startInAppCall({
        calleeAccountId: peerId,
        surgeryId: conversation.surgeryId,
      });
      void navigate({ to: "/call/$callId", params: { callId: call.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start call");
    } finally {
      setCalling(false);
    }
  };

  let lastDay = "";
  const canSend = Boolean(draft.trim() || pendingFile) && !busy && !recording;

  return (
    <AppShell immersive hideNav>
      <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.08),_transparent_55%)]">
        <header className="z-10 flex shrink-0 items-center gap-3 border-b border-border/70 bg-background/95 px-3 py-3 backdrop-blur-md">
          <Link to="/chats" className="rounded-full p-2 hover:bg-accent" aria-label="Back to chats">
            <ArrowLeft className="size-5" />
          </Link>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-700 text-sm font-bold text-primary-foreground">
            {(conversation?.peerName ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold tracking-tight">{conversation?.peerName ?? "Chat"}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {conversation ? `${conversation.peerRole} · secure chat` : "Connecting…"}
            </p>
          </div>
          <button
            type="button"
            disabled={!conversation || calling}
            onClick={() => void callPeer()}
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Start in-app call"
          >
            <Phone className="size-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pb-4">
            {messages.length === 0 ? (
              <div className="mx-auto mt-10 max-w-[16rem] text-center">
                <p className="text-sm font-semibold text-foreground">You're connected</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Send text, photos, video, or voice notes. Phone numbers stay private.
                </p>
              </div>
            ) : null}

            {messages.map((message) => {
              const day = dayLabel(message.createdAt);
              const showDay = day && day !== lastDay;
              if (showDay) lastDay = day;
              return (
                <div key={message.id}>
                  {showDay ? (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-muted/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                        {day}
                      </span>
                    </div>
                  ) : null}
                  <div className={cn("mb-2 flex", message.mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[82%] rounded-[1.15rem] px-3.5 py-2.5 text-base leading-relaxed shadow-sm",
                        message.mine
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border/60 bg-card text-foreground",
                      )}
                    >
                      <MessageBody message={message} />
                      <p
                        className={cn(
                          "mt-1 text-right text-[10px] font-medium",
                          message.mine ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {pendingPreview && pendingKind ? (
            <div className="mb-2 flex items-center gap-3 rounded-2xl border border-border bg-card p-2">
              {pendingKind === "image" ? (
                <img src={pendingPreview} alt="" className="size-14 rounded-xl object-cover" />
              ) : pendingKind === "video" ? (
                <video src={pendingPreview} className="size-14 rounded-xl object-cover" />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Mic className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {pendingKind === "image" ? "Photo ready" : pendingKind === "video" ? "Video ready" : "Voice note ready"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{pendingFile?.name}</p>
              </div>
              <button
                type="button"
                onClick={clearPending}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted"
                aria-label="Remove attachment"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

          {recording ? (
            <div className="mb-2 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              <span className="size-2.5 animate-pulse rounded-full bg-rose-500" />
              <p className="flex-1 text-sm font-semibold">
                Recording… {String(Math.floor(recordSecs / 60)).padStart(2, "0")}:
                {String(recordSecs % 60).padStart(2, "0")}
              </p>
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white"
              >
                <Square className="size-3.5 fill-current" /> Stop
              </button>
            </div>
          ) : null}

          <div className="shrink-0 rounded-[1.35rem] border border-border/80 bg-card/95 p-2 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)] backdrop-blur">
            <div className="flex items-end gap-1.5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={(e) => attachFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                disabled={busy || recording}
                onClick={() => fileRef.current?.click()}
                className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl text-primary hover:bg-accent disabled:opacity-50"
                aria-label="Attach media"
              >
                <ImagePlus className="size-5" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void (recording ? stopRecording() : startRecording())}
                className={cn(
                  "mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-accent disabled:opacity-50",
                  recording ? "bg-rose-100 text-rose-600" : "text-primary",
                )}
                aria-label={recording ? "Stop recording" : "Record voice note"}
              >
                <Mic className="size-5" />
              </button>
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                placeholder="Write a message…"
                className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-base outline-none placeholder:text-muted-foreground/70"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <Button
                size="icon"
                className="size-11 shrink-0 rounded-2xl"
                disabled={!canSend}
                onClick={() => void send()}
                aria-label="Send"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
