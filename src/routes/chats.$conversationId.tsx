import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  getConversationById,
  listMessages,
  markConversationRead,
  sendChatMessage,
} from "@/services/chatService";
import { supabase } from "@/services/supabaseClient";
import type { ChatConversation, ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chats/$conversationId")({
  head: () => ({
    meta: [{ title: "Chat — VetKonnect" }],
  }),
  component: ChatThread,
});

function ChatThread() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const conv = await getConversationById(conversationId);
    if (!conv) {
      toast.error("Chat not found");
      void navigate({ to: "/chats" });
      return;
    }
    setConversation(conv);
    const msgs = await listMessages(conversationId);
    setMessages(msgs);
    await markConversationRead(conversationId);
  };

  useEffect(() => {
    void load().catch((error) => {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not open chat");
    });
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
        () => {
          void listMessages(conversationId).then(setMessages);
          void markConversationRead(conversationId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const send = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const message = await sendChatMessage(conversationId, draft);
      setMessages((prev) => [...prev, message]);
      setDraft("");
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              lastMessagePreview: message.body,
              lastMessageAt: message.createdAt,
            }
          : prev,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <header className="flex items-center gap-3 border-b border-border px-4 py-4">
        <Link to="/chats" className="rounded-full p-2 hover:bg-accent" aria-label="Back to chats">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">{conversation?.peerName ?? "Chat"}</p>
          <p className="text-xs capitalize text-muted-foreground">{conversation?.peerRole ?? "…"}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex-1 space-y-2 overflow-y-auto pb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.mine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  message.mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                {message.body}
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    message.mine ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            placeholder="Type a message…"
            className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            size="icon"
            className="shrink-0 rounded-xl"
            disabled={busy || !draft.trim()}
            onClick={() => void send()}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
