import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mic, MicOff, PhoneOff, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWebRtcCall } from "@/hooks/useWebRtcCall";
import { acceptCall, getCallSession, rejectCall, type CallSession } from "@/services/callService";
import { supabase } from "@/services/supabaseClient";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/call/$callId")({
  head: () => ({
    meta: [{ title: "In-app call — VetKonnect" }],
  }),
  component: InAppCallScreen,
});

function InAppCallScreen() {
  const { callId } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<CallSession | null>(null);
  const [canStart, setCanStart] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const call = await getCallSession(callId);
        if (!call) {
          toast.error("Call not found");
          void navigate({ to: "/chats" });
          return;
        }
        setSession(call);
        if (call.status === "ended" || call.status === "rejected" || call.status === "missed") {
          toast.message("This call has ended");
          void navigate({ to: "/chats" });
          return;
        }
        // Both sides wait until accepted — keeps mic off while ringing.
        if (call.status === "accepted" || call.status === "active") {
          setCanStart(true);
        } else {
          setCanStart(false);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open call");
        void navigate({ to: "/home" });
      }
    })();
  }, [callId, navigate]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`call-status:${callId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_sessions", filter: `id=eq.${callId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const status = String(row.status ?? "");
          if (status === "accepted" || status === "active") {
            setCanStart(true);
            setSession((prev) => (prev ? { ...prev, status: status as CallSession["status"] } : prev));
          }
          if (status === "ended" || status === "rejected" || status === "missed") {
            toast.message("Call ended");
            void navigate({ to: session.amCaller ? "/discover" : "/patients" });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [callId, navigate, session]);

  const { status, error, muted, hangUp, toggleMute } = useWebRtcCall({
    callId,
    amCaller: Boolean(session?.amCaller),
    canStart: Boolean(session && canStart),
    onRemoteStream: (stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    },
    onEnded: () => {
      void navigate({ to: session?.amCaller ? "/discover" : "/patients" });
    },
  });

  useEffect(() => {
    if (status !== "live") return;
    const started = Date.now();
    const tick = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(tick);
  }, [status]);

  const accept = async () => {
    try {
      const next = await acceptCall(callId);
      setSession(next);
      setCanStart(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not answer");
    }
  };

  const decline = async () => {
    await rejectCall(callId);
    void navigate({ to: "/patients" });
  };

  const leave = async () => {
    await hangUp();
    void navigate({ to: session?.amCaller ? "/discover" : "/patients" });
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-sm text-slate-300">
        Connecting call…
      </div>
    );
  }

  const needsAccept = !session.amCaller && !canStart && session.status === "ringing";

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-teal-950 px-6 py-10 text-white">
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-between">
        <div className="pt-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-200/80">VetKonnect call</p>
          <div className="mx-auto mt-8 flex size-28 items-center justify-center rounded-full bg-white/10 text-4xl font-bold text-teal-100">
            {session.peerName.charAt(0).toUpperCase()}
          </div>
          <h1 className="mt-6 text-2xl font-bold">{session.peerName}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {needsAccept
              ? "Incoming voice call"
              : status === "live"
                ? `${mm}:${ss}`
                : status === "connecting"
                  ? "Connecting securely…"
                  : status === "error"
                    ? error || "Call error"
                    : session.amCaller
                      ? "Calling…"
                      : "In-app voice call"}
          </p>
          <p className="mt-3 text-xs text-slate-400">Private web call · numbers stay hidden</p>
        </div>

        {error ? <p className="text-center text-sm text-rose-300">{error}</p> : null}

        <div className="mb-6 flex w-full flex-col items-center gap-6">
          {needsAccept ? (
            <div className="flex items-center gap-6">
              <Button
                size="lg"
                variant="secondary"
                className="size-16 rounded-full bg-rose-600 text-white hover:bg-rose-500"
                onClick={() => void decline()}
              >
                <PhoneOff className="size-6" />
              </Button>
              <Button
                size="lg"
                className="size-16 rounded-full bg-emerald-500 text-white hover:bg-emerald-400"
                onClick={() => void accept()}
              >
                <Phone className="size-6" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={toggleMute}
                className={cn(
                  "flex size-14 items-center justify-center rounded-full",
                  muted ? "bg-white text-slate-900" : "bg-white/15 text-white",
                )}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </button>
              <button
                type="button"
                onClick={() => void leave()}
                className="flex size-16 items-center justify-center rounded-full bg-rose-600 text-white"
                aria-label="End call"
              >
                <PhoneOff className="size-7" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
