import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Eye, Heart, MessageCircle, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useApp } from "@/hooks/useApp";
import { cn } from "@/lib/utils";
import { getVideoPosts, recordPostView, toggleLike } from "@/services/contentService";
import type { CommunityPost } from "@/types";

export const Route = createFileRoute("/community/clips")({
  head: () => ({
    meta: [
      { title: "Clips — VetKonnect" },
      { name: "description", content: "Short videos from the VetKonnect community." },
    ],
  }),
  component: ClipsPage,
});

function ClipsPage() {
  const { user } = useApp();
  const [clips, setClips] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const needMute = useCallback(() => setMuted(true), []);
  const countedViews = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    void getVideoPosts()
      .then((next) => {
        if (!alive) return;
        setClips(next);
        setActiveId(next[0]?.id ?? null);
      })
      .catch((error) => {
        console.error(error);
        toast.error("Could not load clips");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!activeId || countedViews.current.has(activeId)) return;
    countedViews.current.add(activeId);
    const postId = activeId;
    void recordPostView(postId, user.fullName)
      .then((updated) => {
        if (!updated) return;
        setClips((prev) => prev.map((item) => (item.id === postId ? { ...item, views: updated.views } : item)));
      })
      .catch((error) => {
        countedViews.current.delete(postId);
        console.error(error);
      });
  }, [activeId, user.fullName]);

  const onToggleLike = async (post: CommunityPost) => {
    try {
      const updated = await toggleLike(post.id);
      setClips((prev) => prev.map((item) => (item.id === post.id ? updated : item)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not like that clip");
    }
  };

  return (
    <AppShell immersive hideNav>
      <div className="absolute inset-0 bg-black text-white">
        <div className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-center px-3">
          <Link
            to="/community"
            activeOptions={{ exact: true }}
            aria-label="Back to community"
            className="pointer-events-auto absolute left-3 flex size-10 items-center justify-center rounded-full bg-black/30 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/15 backdrop-blur-md"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
            Clips
          </p>
        </div>

        {loading ? <p className="flex h-full items-center justify-center text-sm text-white/80">Loading clips…</p> : null}

        {!loading && clips.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">Clips</p>
            <p className="mt-3 text-lg font-semibold">No clips yet</p>
            <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-white/65">
              Short videos posted in the community will play here.
            </p>
            <Link to="/community" activeOptions={{ exact: true }} className="mt-5 text-sm font-semibold text-primary">
              Back to community
            </Link>
          </div>
        ) : null}

        {clips.length > 0 ? (
          <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {clips.map((clip) => (
              <ClipSlide
                key={clip.id}
                post={clip}
                active={activeId === clip.id}
                muted={muted}
                onActive={setActiveId}
                onNeedMute={needMute}
                onToggleMute={() => setMuted((value) => !value)}
                onToggleLike={() => void onToggleLike(clip)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function ClipSlide({
  post,
  active,
  muted,
  onActive,
  onNeedMute,
  onToggleMute,
  onToggleLike,
}: {
  post: CommunityPost;
  active: boolean;
  muted: boolean;
  onActive: (id: string) => void;
  onNeedMute: () => void;
  onToggleMute: () => void;
  onToggleLike: () => void;
}) {
  const frameRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);

  const markActive = useCallback(() => onActive(post.id), [onActive, post.id]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.65) markActive();
      },
      { threshold: [0.65] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [markActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!active) {
      video.pause();
      return;
    }
    video.muted = muted;
    void video.play().catch(() => {
      if (!muted) onNeedMute();
    });
  }, [active, muted, onNeedMute]);

  return (
    <section ref={frameRef} className="relative h-full snap-start snap-always">
      <video
        ref={videoRef}
        src={post.videoUrl}
        playsInline
        loop
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          if (!video.duration) return;
          setProgress((video.currentTime / video.duration) * 100);
        }}
        className="h-full w-full bg-black object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 pb-24">
        <div className="pointer-events-auto flex items-end justify-between gap-5">
          <div className="min-w-0 pb-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
              {post.authorPremium ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Premium" /> : null}
              <span className="truncate">{post.author}</span>
            </p>
            {post.tag ? (
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">{post.tag}</p>
            ) : null}
            <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]">
              {post.body}
            </p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <button type="button" onClick={onToggleLike} aria-label={`${post.likes} likes`} className="flex flex-col items-center gap-1">
              <span className="flex size-11 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] ring-1 ring-white/20 backdrop-blur-md">
                <Heart className={cn("size-6", post.likedByMe && "fill-red-500 text-red-500")} />
              </span>
              <span className="text-[11px] font-semibold tabular-nums">{post.likes}</span>
            </button>
            <Link to="/community/$postId" params={{ postId: post.id }} className="flex flex-col items-center gap-1">
              <span className="flex size-11 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] ring-1 ring-white/20 backdrop-blur-md">
                <MessageCircle className="size-6" />
              </span>
              <span className="text-[11px] font-semibold tabular-nums">{post.comments}</span>
            </Link>
            <div className="flex flex-col items-center gap-1" aria-label={`${post.views} ${post.views === 1 ? "view" : "views"}`}>
              <span className="flex size-11 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] ring-1 ring-white/20 backdrop-blur-md">
                <Eye className="size-6" />
              </span>
              <span className="text-[11px] font-semibold tabular-nums">{post.views}</span>
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="flex size-11 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] ring-1 ring-white/20 backdrop-blur-md"
            >
              {muted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
            </button>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 h-[3px] bg-white/15">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-yellow-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}
