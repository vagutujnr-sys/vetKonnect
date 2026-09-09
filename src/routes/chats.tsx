import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownLeft,
  ArrowUpRight,
  MessageSquare,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { listCallHistory, startInAppCall, type CallSession } from "@/services/callService";
import { listConversations } from "@/services/chatService";
import { supabase } from "@/services/supabaseClient";
import { getSessionAccountId } from "@/services/userService";
import type { ChatConversation } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/chats")({
  head: () => ({
    meta: [
      { title: "Messages — VetKonnect" },
      { name: "description", content: "In-app chats and call history with vets and pet owners." },
    ],
  }),
  component: ChatsHub,
});

type HubTab = "messages" | "calls";

function formatRelative(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function callStatusLabel(call: CallSession): string {
  if (call.status === "missed" || call.status === "rejected") return "Missed";
  if (call.status === "ringing") return "Ringing";
  if (call.status === "ended" || call.status === "active" || call.status === "accepted") {
    if (call.answeredAt) return call.amCaller ? "Outgoing" : "Incoming";
    return call.amCaller ? "No answer" : "Missed";
  }
  return call.status;
}

function ChatsHub() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<HubTab>("messages");
  const [items, setItems] = useState<ChatConversation[]>([]);
  const [calls, setCalls] = useState<CallSession[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [callingId, setCallingId] = useState<string | null>(null);

  const refreshChats = async () => {
    const next = await listConversations();
    setItems(next);
  };

  const refreshCalls = async () => {
    const next = await listCallHistory();
    setCalls(next);
  };

  useEffect(() => {
    void refreshChats()
      .catch((error) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "Could not load chats");
      })
      .finally(() => setLoadingChats(false));

    void refreshCalls()
      .catch((error) => console.error(error))
      .finally(() => setLoadingCalls(false));
  }, []);

  useEffect(() => {
    const me = getSessionAccountId();
    if (!me) return;

    const channel = supabase
      .channel(`chats-hub:${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void refreshChats().catch(() => undefined);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void refreshChats().catch(() => undefined);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "call_sessions" }, () => {
        void refreshCalls().catch(() => undefined);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const redial = async (call: CallSession) => {
    const me = getSessionAccountId();
    if (!me) return;
    const peerId = call.amCaller ? call.calleeAccountId : call.callerAccountId;
    setCallingId(call.id);
    try {
      const next = await startInAppCall({
        calleeAccountId: peerId,
        surgeryId: call.surgeryId,
      });
      void navigate({ to: "/call/$callId", params: { callId: next.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start call");
    } finally {
      setCallingId(null);
    }
  };

  return (
    <AppShell immersive>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="relative z-10 shrink-0 border-b border-border/60 bg-background/95 px-5 pb-3 pt-8 backdrop-blur-md">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-8 size-40 rounded-full bg-primary/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-8 top-16 size-28 rounded-full bg-teal-400/10 blur-2xl"
          />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Inbox</p>
          <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight text-foreground">Messages</h1>
          <p className="relative mt-1.5 max-w-[20rem] text-sm text-muted-foreground">
            Private chats and in-app calls with your care team.
          </p>

          <div className="relative mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted/80 p-1">
            {(
              [
                { id: "messages" as const, label: "Chats", count: items.reduce((n, c) => n + c.unreadCount, 0) },
                { id: "calls" as const, label: "Calls", count: 0 },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                  tab === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {item.id === "messages" && item.count > 0 ? (
                  <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {item.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-32 pt-4">
        {tab === "messages" ? (
          <>
            {loadingChats ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-muted/70" />
                ))}
              </div>
            ) : null}

            {!loadingChats && items.length === 0 ? (
              <div className="rounded-[1.5rem] border border-border/80 bg-gradient-to-b from-card to-muted/30 px-6 py-10 text-center shadow-sm">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageSquare className="size-7" />
                </span>
                <p className="mt-4 text-lg font-bold">No conversations yet</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Start from Discover → Map Vets with Message. Your thread with the clinic stays here.
                </p>
                <Link
                  to="/discover"
                  className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Find a clinic
                </Link>
              </div>
            ) : null}

            <div className="space-y-2.5">
              {items.map((chat) => (
                <Link
                  key={chat.id}
                  to="/chats/$conversationId"
                  params={{ conversationId: chat.id }}
                  className="group flex items-center gap-3.5 rounded-[1.25rem] border border-border/70 bg-card/90 px-3.5 py-3.5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.45)] transition hover:border-primary/25 hover:bg-accent/40"
                >
                  <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-700 text-base font-bold text-primary-foreground shadow-sm">
                    {chat.peerName.charAt(0).toUpperCase()}
                    {chat.unreadCount > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-card bg-emerald-400" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-bold tracking-tight">{chat.peerName}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {chat.peerRole}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-sm",
                        chat.unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {chat.lastMessagePreview || "Say hello — start the conversation"}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {formatRelative(chat.lastMessageAt)}
                    </span>
                    {chat.unreadCount > 0 ? (
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {chat.unreadCount}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            {loadingCalls ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-muted/70" />
                ))}
              </div>
            ) : null}

            {!loadingCalls && calls.length === 0 ? (
              <div className="rounded-[1.5rem] border border-border/80 bg-gradient-to-b from-card to-muted/30 px-6 py-10 text-center shadow-sm">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Phone className="size-7" />
                </span>
                <p className="mt-4 text-lg font-bold">No calls yet</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  In-app voice calls from Map Vets appear here. Numbers stay private.
                </p>
              </div>
            ) : null}

            <div className="space-y-2.5">
              {calls.map((call) => {
                const missed = call.status === "missed" || call.status === "rejected" || (!call.answeredAt && call.status === "ended" && !call.amCaller);
                const Icon = missed
                  ? PhoneMissed
                  : call.amCaller
                    ? PhoneOutgoing
                    : PhoneIncoming;
                return (
                  <div
                    key={call.id}
                    className="flex items-center gap-3.5 rounded-[1.25rem] border border-border/70 bg-card/90 px-3.5 py-3.5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.45)]"
                  >
                    <span
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-full",
                        missed ? "bg-rose-100 text-rose-600" : "bg-primary/10 text-primary",
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold tracking-tight">{call.peerName}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        {call.amCaller ? (
                          <ArrowUpRight className="size-3.5 shrink-0" />
                        ) : (
                          <ArrowDownLeft className="size-3.5 shrink-0" />
                        )}
                        <span className={cn(missed && "text-rose-600")}>{callStatusLabel(call)}</span>
                        <span>·</span>
                        <span>{formatRelative(call.createdAt)}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={callingId === call.id}
                      onClick={() => void redial(call)}
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary disabled:opacity-60"
                      aria-label={`Call ${call.peerName}`}
                    >
                      <Phone className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>
    </AppShell>
  );
}
