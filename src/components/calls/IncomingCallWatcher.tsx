import { useNavigate } from "@tanstack/react-router";
import { Phone, PhoneOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { acceptCall, listRingingCallsForMe, rejectCall, type CallSession } from "@/services/callService";
import { supabase } from "@/services/supabaseClient";
import { playNotificationSound } from "@/lib/notificationSound";

/** Listens for incoming in-app calls while the user is signed in. */
export function IncomingCallWatcher() {
  const { ready, user } = useApp();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<CallSession | null>(null);

  useEffect(() => {
    if (!ready || !user.id || user.id === "admin-session") return;

    let cancelled = false;

    const refresh = async () => {
      try {
        const ringing = await listRingingCallsForMe();
        if (cancelled) return;
        const next = ringing[0] ?? null;
        setIncoming((prev) => {
          if (next && (!prev || prev.id !== next.id)) {
            playNotificationSound();
          }
          return next;
        });
      } catch {
        /* migration may be missing */
      }
    };

    void refresh();

    const channel = supabase
      .channel(`incoming-calls:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sessions",
          filter: `callee_account_id=eq.${user.id}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    const interval = window.setInterval(() => void refresh(), 8000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [ready, user.id]);

  if (!incoming) return null;

  // Don't overlay if already on the call screen.
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/call/")) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-4 pt-4">
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-lg">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Phone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-emerald-950">Incoming call</p>
          <p className="truncate text-xs text-emerald-900/80">{incoming.peerName}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="bg-rose-600 text-white hover:bg-rose-500"
          onClick={() => void rejectCall(incoming.id).then(() => setIncoming(null))}
        >
          <PhoneOff className="size-4" />
        </Button>
        <Button
          size="sm"
          className="bg-emerald-700 hover:bg-emerald-600"
          onClick={() => {
            void (async () => {
              try {
                await acceptCall(incoming.id);
                setIncoming(null);
                await navigate({ to: "/call/$callId", params: { callId: incoming.id } });
              } catch {
                await navigate({ to: "/call/$callId", params: { callId: incoming.id } });
              }
            })();
          }}
        >
          Answer
        </Button>
      </div>
    </div>
  );
}
