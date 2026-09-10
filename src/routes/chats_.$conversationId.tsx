import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  HeartPulse,
  ImagePlus,
  Mic,
  PawPrint,
  Phone,
  Reply,
  Send,
  Square,
  Syringe,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useApp } from "@/hooks/useApp";
import { isVetAccount } from "@/lib/account";
import { startInAppCall } from "@/services/callService";
import {
  getConversationById,
  listMessages,
  markConversationRead,
  sendChatMessage,
  setConversationPet,
  uploadChatMedia,
  chatMediaLabel,
  type ChatMediaType,
} from "@/services/chatService";
import { getPetRecordById } from "@/services/petService";
import { rememberPatientId } from "@/services/vetService";
import { supabase } from "@/services/supabaseClient";
import { getSessionAccountId } from "@/services/userService";
import type { ChatConversation, ChatMessage, Pet } from "@/types";
import { cn } from "@/lib/utils";

function displayValue(value: string | number | null | undefined, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

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
      {message.replyToId ? (
        <div
          className={cn(
            "mb-2 rounded-xl border-l-2 px-2.5 py-1.5 text-xs",
            message.mine
              ? "border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground/90"
              : "border-primary/50 bg-muted/80 text-muted-foreground",
          )}
        >
          <p className="font-semibold">{message.replySenderName || "Reply"}</p>
          <p className="mt-0.5 line-clamp-2">{message.replyPreview || "Message"}</p>
        </div>
      ) : null}
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

/** Horizontal swipe to reply (iMessage-style). */
function SwipeToReply({
  mine,
  onReply,
  children,
}: {
  mine: boolean;
  onReply: () => void;
  children: ReactNode;
}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const [offset, setOffset] = useState(0);
  const max = 72;

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    dragging.current = true;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!dragging.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      dragging.current = false;
      setOffset(0);
      return;
    }
    // Swipe toward center: others → right, mine → left
    const next = mine ? Math.min(0, Math.max(-max, dx)) : Math.max(0, Math.min(max, dx));
    setOffset(next);
  };

  const onTouchEnd = () => {
    dragging.current = false;
    if (Math.abs(offset) >= max * 0.55) onReply();
    setOffset(0);
  };

  return (
    <div className="relative overflow-hidden">
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 flex items-center",
          mine ? "right-2" : "left-2",
        )}
        style={{ opacity: Math.min(1, Math.abs(offset) / (max * 0.55)) }}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Reply className="size-4" />
        </span>
      </div>
      <div
        className="touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? "none" : "transform 160ms ease-out",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

function ChatThread() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const { pets, user } = useApp();
  const isVet = isVetAccount(user);
  const isOwner = !isVet;
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [petPickerOpen, setPetPickerOpen] = useState(false);
  const [aligningPet, setAligningPet] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [recordsPet, setRecordsPet] = useState<Pet | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
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
            replyToId: row.reply_to_id ? String(row.reply_to_id) : null,
            replyPreview: row.reply_preview ? String(row.reply_preview) : null,
            replySenderName: row.reply_sender_name ? String(row.reply_sender_name) : null,
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
      const message = await sendChatMessage(conversationId, text, media, replyTo);
      setReplyTo(null);
      mergeMessages([message]);
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              lastMessagePreview: message.body || chatMediaLabel(message.mediaType),
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

  useEffect(() => {
    const channel = supabase
      .channel(`chat-meta:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        () => {
          void getConversationById(conversationId).then((conv) => {
            if (conv) setConversation(conv);
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const alignPet = async (petId: string | null) => {
    setAligningPet(true);
    try {
      const next = await setConversationPet(conversationId, petId);
      setConversation(next);
      setPetPickerOpen(false);
      toast.success(petId ? `Chat aligned to ${next.petName}` : "Pet reference cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update pet reference");
    } finally {
      setAligningPet(false);
    }
  };

  const openPetRecords = () => {
    if (!conversation?.petId) return;
    if (isVet) {
      rememberPatientId(conversation.petId);
      setRecordsOpen(true);
      setRecordsLoading(true);
      setRecordsPet(null);
      void getPetRecordById(conversation.petId)
        .then((record) => {
          if (!record) {
            toast.error("Patient not found.");
            setRecordsOpen(false);
            return;
          }
          setRecordsPet(record);
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "Could not load health card.");
          setRecordsOpen(false);
        })
        .finally(() => setRecordsLoading(false));
      return;
    }
    void navigate({ to: "/pets/$petId", params: { petId: conversation.petId } });
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
  const linkedPetMeta = [conversation?.petSpecies, conversation?.petBreed].filter(Boolean).join(" · ");

  return (
    <AppShell immersive hideNav>
      <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.08),_transparent_55%)]">
        <header className="z-10 shrink-0 border-b border-border/70 bg-background/95 backdrop-blur-md">
          <div className="flex items-center gap-3 px-3 py-3">
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
          </div>

          {conversation?.petId && conversation.petName ? (
            <div className="flex items-center gap-3 border-t border-border/60 bg-accent/40 px-3 py-2.5">
              {conversation.petPhotoUrl ? (
                <img
                  src={conversation.petPhotoUrl}
                  alt=""
                  className="size-11 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <PawPrint className="size-5" />
                </span>
              )}
              <button type="button" onClick={openPetRecords} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-bold">{conversation.petName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {linkedPetMeta || "Linked pet"} ·{" "}
                  {isVet ? "Health card summary" : "View passport"}
                </p>
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => setPetPickerOpen(true)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                >
                  Change
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openPetRecords}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Records
                </button>
              )}
            </div>
          ) : isOwner ? (
            <button
              type="button"
              onClick={() => setPetPickerOpen(true)}
              className="flex w-full items-center gap-3 border-t border-border/60 bg-muted/40 px-3 py-2.5 text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-primary/40 bg-background text-primary">
                <PawPrint className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Align a pet</span>
                <span className="block text-xs text-muted-foreground">
                  Help the vet know which pet this chat is about
                </span>
              </span>
            </button>
          ) : (
            <div className="border-t border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Waiting for the owner to align a pet to this chat.
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
          <div className="scrollbar-none min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pb-4">
            {messages.length === 0 ? (
              <div className="mx-auto mt-10 max-w-[16rem] text-center">
                <p className="text-sm font-semibold text-foreground">You're connected</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {isOwner
                    ? "Align a pet so the vet can review their health card. Swipe messages to reply."
                    : "Once a pet is aligned, open their records from the header."}
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
                  <SwipeToReply
                    mine={message.mine}
                    onReply={() => {
                      setReplyTo(message);
                      composerRef.current?.focus();
                    }}
                  >
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
                  </SwipeToReply>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {replyTo ? (
            <div className="mb-2 flex items-start gap-2 rounded-2xl border border-border bg-card px-3 py-2">
              <Reply className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary">
                  Replying to {replyTo.mine ? "yourself" : conversation?.peerName || "message"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {replyTo.body || chatMediaLabel(replyTo.mediaType)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Cancel reply"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null}

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
                  {pendingKind === "image"
                    ? "Photo ready"
                    : pendingKind === "video"
                      ? "Video ready"
                      : "Voice note ready"}
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

      {petPickerOpen ? (
        <div className="absolute inset-0 z-40 flex flex-col bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-extrabold">Align a pet</p>
              <p className="text-xs text-muted-foreground">The vet can review this pet’s health card from the chat</p>
            </div>
            <button
              type="button"
              onClick={() => setPetPickerOpen(false)}
              className="rounded-full p-2 hover:bg-accent"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="scrollbar-none flex-1 space-y-2 overflow-y-auto px-4 py-4">
            {pets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                <PawPrint className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 font-semibold">No pets yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add a pet first, then align this chat.</p>
                <Link to="/pets/new" className="mt-4 inline-block text-sm font-semibold text-primary">
                  Add a pet
                </Link>
              </div>
            ) : (
              pets.map((pet) => {
                const selected = conversation?.petId === pet.id;
                return (
                  <button
                    key={pet.id}
                    type="button"
                    disabled={aligningPet}
                    onClick={() => void alignPet(pet.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left",
                      selected ? "border-primary bg-accent/50" : "border-border bg-card",
                    )}
                  >
                    {pet.photoUrl ? (
                      <img src={pet.photoUrl} alt="" className="size-12 rounded-xl object-cover" />
                    ) : (
                      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <PawPrint className="size-5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{pet.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {[pet.species, pet.breed].filter(Boolean).join(" · ") || "Pet"}
                      </span>
                    </span>
                    {selected ? <Check className="size-5 shrink-0 text-primary" /> : null}
                  </button>
                );
              })
            )}
            {conversation?.petId ? (
              <button
                type="button"
                disabled={aligningPet}
                onClick={() => void alignPet(null)}
                className="mt-2 w-full rounded-2xl border border-border px-3 py-3 text-sm font-semibold text-muted-foreground"
              >
                Clear pet reference
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <Drawer
        open={recordsOpen}
        onOpenChange={(open) => {
          setRecordsOpen(open);
          if (!open) {
            setRecordsPet(null);
            setRecordsLoading(false);
          }
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="border-b border-border/70 text-left">
            <DrawerTitle>Health card</DrawerTitle>
            <DrawerDescription>
              Quick summary while you stay in this chat.
            </DrawerDescription>
          </DrawerHeader>

          <div className="scrollbar-none overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
            {recordsLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading health card…</p>
            ) : recordsPet ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {recordsPet.photoUrl ? (
                    <img
                      src={recordsPet.photoUrl}
                      alt=""
                      className="size-16 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <PawPrint className="size-7" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xl font-extrabold">{displayValue(recordsPet.name)}</p>
                        <p className="text-sm text-muted-foreground">
                          {displayValue(recordsPet.breed)} · {displayValue(recordsPet.sex)} ·{" "}
                          {displayValue(recordsPet.ageYears)} years
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {displayValue(recordsPet.vetConnectId)}
                          {recordsPet.collarId ? ` · Tag ${recordsPet.collarId}` : ""}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                        <HeartPulse className="size-3.5" />
                        {displayValue(recordsPet.healthStatus)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-surface p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">Weight</p>
                    <p className="mt-1 truncate text-sm font-semibold">
                      {Number(recordsPet.weightKg || 0).toFixed(1)} kg
                    </p>
                  </div>
                  <div className="rounded-2xl bg-surface p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">Meds today</p>
                    <p className="mt-1 truncate text-sm font-semibold">
                      {displayValue(recordsPet.medicationToday)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-surface p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">Next vaccine</p>
                    <p className="mt-1 truncate text-sm font-semibold">
                      {displayValue(recordsPet.nextVaccine)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold">Recent history</p>
                  <ol className="mt-2 space-y-3 border-l border-border pl-4">
                    {(recordsPet.timeline?.length ? recordsPet.timeline.slice(0, 5) : []).map((event) => (
                      <li key={event.id} className="relative">
                        <span className="absolute -left-[23px] top-1 flex size-3.5 items-center justify-center rounded-full bg-primary">
                          <Syringe className="size-2 text-primary-foreground" />
                        </span>
                        <p className="text-[11px] text-muted-foreground">{displayValue(event.date)}</p>
                        <p className="text-sm font-semibold">{displayValue(event.title)}</p>
                        <p className="text-xs text-muted-foreground">{displayValue(event.detail)}</p>
                      </li>
                    ))}
                    {!recordsPet.timeline?.length ? (
                      <li className="text-sm text-muted-foreground">No history events yet.</li>
                    ) : null}
                  </ol>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setRecordsOpen(false)}
                >
                  Back to chat
                </Button>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No health card available.</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}
