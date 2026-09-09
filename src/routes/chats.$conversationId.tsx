import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Phone, Send } from "lucide-react";
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
} from "@/services/chatService";
import { supabase } from "@/services/supabaseClient";
import { getSessionAccountId } from "@/services/userService";
import type { ChatConversation, ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chats/$conversationId")({
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

function ChatThread() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const mergeMessages = (incoming: ChatMessage[]) => {
    setMessages((prev) => {
      const map = new Map<string, ChatMessage>();
      for (const msg of prev) map.set(msg.id, msg);
      for (const msg of incoming) map.set(msg.id, msg);
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
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
          const mapped: ChatMessage = {
            id: String(row.id),
            conversationId: String(row.conversation_id),
            senderAccountId: String(row.sender_account_id),
            body: String(row.body ?? ""),
            readByRecipient: Boolean(row.read_by_recipient),
            createdAt: String(row.created_at ?? ""),
            mine: String(row.sender_account_id) === me,
          };
          mergeMessages([mapped]);
          if (!mapped.mine) void markConversationRead(conversationId);
        },
      )
      .subscribe();

    // Light polling fallback if realtime is delayed.
    const poll = window.setInterval(() => {
      void listMessages(conversationId).then(mergeMessages).catch(() => undefined);
    }, 12000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const send = async () => {
    if (!draft.trim() || busy) return;
    setBusy(true);
    const text = draft;
    setDraft("");
    try {
      const message = await sendChatMessage(conversationId, text);
      mergeMessages([message]);
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              lastMessagePreview: message.body,
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

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.08),_transparent_55%)]">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/70 bg-background/90 px-3 py-3 backdrop-blur-md">
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

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-3">
          <div className="flex-1 space-y-1 overflow-y-auto pb-4">
            {messages.length === 0 ? (
              <div className="mx-auto mt-10 max-w-[16rem] text-center">
                <p className="text-sm font-semibold text-foreground">You're connected</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Messages stay in VetKonnect. Phone numbers are never shared here.
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
                        "max-w-[82%] rounded-[1.15rem] px-3.5 py-2.5 text-[15px] leading-relaxed shadow-sm",
                        message.mine
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border/60 bg-card text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
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

          <div className="rounded-[1.35rem] border border-border/80 bg-card/95 p-2 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.5)] backdrop-blur">
            <div className="flex items-end gap-2">
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                placeholder="Write a message…"
                className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-muted-foreground/70"
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
                disabled={busy || !draft.trim()}
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
