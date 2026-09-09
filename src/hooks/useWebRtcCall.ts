import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  CALL_ICE_SERVERS,
  endCall,
  markCallActive,
  sendCallSignal,
  subscribeCallSignals,
  type CallSignal,
} from "@/services/callService";
import { getSessionAccountId } from "@/services/userService";

type Options = {
  callId: string;
  amCaller: boolean;
  /** When true, callee has accepted — caller may send offer. */
  canStart: boolean;
  onRemoteStream?: (stream: MediaStream | null) => void;
  onEnded?: () => void;
};

export function useWebRtcCall({ callId, amCaller, canStart, onRemoteStream, onEnded }: Options) {
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const makingOffer = useRef(false);
  const polite = !amCaller;

  useEffect(() => {
    if (!canStart) return;
    let cancelled = false;
    const me = getSessionAccountId();
    if (!me) {
      setError("Not signed in");
      setStatus("error");
      return;
    }

    async function boot() {
      setStatus("connecting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;

        const pc = new RTCPeerConnection({ iceServers: CALL_ICE_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          const remote = event.streams[0] ?? new MediaStream([event.track]);
          onRemoteStream?.(remote);
          setStatus("live");
          void markCallActive(callId);
        };

        pc.onicecandidate = (event) => {
          if (!event.candidate || !channelRef.current) return;
          void sendCallSignal(channelRef.current, {
            type: "ice",
            from: me!,
            candidate: event.candidate.toJSON(),
          });
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setStatus("ended");
            onEnded?.();
          }
          if (pc.connectionState === "connected") {
            setStatus("live");
            void markCallActive(callId);
          }
        };

        const channel = subscribeCallSignals(callId, (signal) => {
          void handleSignal(signal, pc, me!);
        });
        channelRef.current = channel;

        // Announce readiness so the caller can send the offer.
        await sendCallSignal(channel, { type: "ready", from: me! });

        if (amCaller) {
          await createAndSendOffer(pc, me!);
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Could not start microphone / call");
        setStatus("error");
      }
    }

    async function createAndSendOffer(pc: RTCPeerConnection, from: string) {
      if (!channelRef.current || makingOffer.current) return;
      makingOffer.current = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendCallSignal(channelRef.current, {
          type: "offer",
          from,
          sdp: pc.localDescription!.toJSON(),
        });
      } finally {
        makingOffer.current = false;
      }
    }

    async function handleSignal(signal: CallSignal, pc: RTCPeerConnection, me: string) {
      if (signal.from === me) return;
      if (signal.type === "ready" && amCaller) {
        if (!pc.currentRemoteDescription) {
          await createAndSendOffer(pc, me);
        }
        return;
      }
      if (signal.type === "offer" && !amCaller) {
        await pc.setRemoteDescription(signal.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (channelRef.current) {
          await sendCallSignal(channelRef.current, {
            type: "answer",
            from: me,
            sdp: pc.localDescription!.toJSON(),
          });
        }
        return;
      }
      if (signal.type === "answer" && amCaller) {
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription(signal.sdp);
        }
        return;
      }
      if (signal.type === "ice") {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!polite) console.warn(err);
        }
        return;
      }
      if (signal.type === "hangup") {
        setStatus("ended");
        onEnded?.();
      }
    }

    void boot();

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      if (channelRef.current) {
        void supabaseRemove(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per call start
  }, [callId, amCaller, canStart]);

  const hangUp = async () => {
    const me = getSessionAccountId();
    if (channelRef.current && me) {
      await sendCallSignal(channelRef.current, { type: "hangup", from: me });
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    await endCall(callId);
    setStatus("ended");
    onEnded?.();
  };

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };

  return { status, error, muted, hangUp, toggleMute };
}

async function supabaseRemove(channel: RealtimeChannel) {
  const { supabase } = await import("@/services/supabaseClient");
  await supabase.removeChannel(channel);
}
