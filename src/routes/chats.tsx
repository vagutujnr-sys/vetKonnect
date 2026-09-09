import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { listConversations } from "@/services/chatService";
import type { ChatConversation } from "@/types";

export const Route = createFileRoute("/chats")({
  head: () => ({
    meta: [
      { title: "Chats — VetKonnect" },
      { name: "description", content: "Your conversations with vets and pet owners." },
    ],
  }),
  component: ChatsList,
});

function ChatsList() {
  const [items, setItems] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listConversations()
      .then(setItems)
      .catch((error) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Could not load chats");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <ScreenHeader title="Chats" subtitle="Messages with vets and pet owners stay here after you start them." />
      <div className="px-5 pb-8">
        {loading ? <p className="text-sm text-muted-foreground">Loading chats…</p> : null}
        {!loading && items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <MessageSquare className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">No chats yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Owners can start a chat from Discover → Map Vets using the message icon.
            </p>
            <Link to="/discover" className="mt-4 inline-block text-sm font-semibold text-primary">
              Open Discover
            </Link>
          </div>
        ) : null}
        <div className="space-y-2">
          {items.map((chat) => (
            <Link
              key={chat.id}
              to="/chats/$conversationId"
              params={{ conversationId: chat.id }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
                {chat.peerName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{chat.peerName}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {chat.peerRole}
                  </span>
                  {chat.unreadCount > 0 ? (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {chat.unreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                  {chat.lastMessagePreview || "No messages yet"}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
