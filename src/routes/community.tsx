import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Eye,
  Heart,
  ImagePlus,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Share2,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/community/ImageLightbox";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import {
  addComment,
  createPost,
  getComments,
  getPosts,
  toggleLike,
  uploadCommunityMedia,
} from "@/services/contentService";
import type { CommunityComment, CommunityPost, MediaType } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — VetKonnect" },
      { name: "description", content: "Stories, breeding tips, rescue updates and veterinary education." },
      { property: "og:title", content: "Community — VetKonnect" },
      { property: "og:description", content: "Connect with animal lovers and learn from veterinary professionals." },
    ],
  }),
  component: Community,
});

const filters = ["All", "Story", "Education", "Rescue", "Breeding"] as const;
const PAGE_SIZE = 6;

function Community() {
  const { user } = useApp();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [postsData, setPostsData] = useState<CommunityPost[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeCommentsPost, setActiveCommentsPost] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postTag, setPostTag] = useState<CommunityPost["tag"]>("Story");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("none");
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingLock = useRef(false);

  const loadPage = useCallback(async (nextOffset: number, replace = false) => {
    if (loadingLock.current) return;
    loadingLock.current = true;
    setLoadingMore(true);
    try {
      const batch = await getPosts({ limit: PAGE_SIZE, offset: nextOffset });
      setPostsData((prev) => (replace ? batch : [...prev, ...batch]));
      setOffset(nextOffset + batch.length);
      setHasMore(batch.length === PAGE_SIZE);
    } catch (error) {
      console.error(error);
      toast.error("Could not load community posts");
    } finally {
      setLoadingMore(false);
      setInitialLoading(false);
      loadingLock.current = false;
    }
  }, []);

  useEffect(() => {
    void loadPage(0, true);
  }, [loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !initialLoading) {
          void loadPage(offset);
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, initialLoading, loadPage, offset]);

  useEffect(() => {
    if (!activeCommentsPost) {
      setComments([]);
      return;
    }
    void getComments(activeCommentsPost)
      .then(setComments)
      .catch((error) => {
        console.error(error);
        toast.error("Could not load comments");
      });
  }, [activeCommentsPost]);

  const posts = filter === "All" ? postsData : postsData.filter((p) => p.tag === filter);

  const onPickMedia = (file: File | null) => {
    if (!file) {
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType("none");
      return;
    }
    const type: MediaType = file.type.startsWith("video/") ? "video" : "image";
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
  };

  const publish = async () => {
    if (!postBody.trim() && !mediaFile) {
      toast.error("Add some text or media to post.");
      return;
    }
    setBusy(true);
    try {
      let uploadedUrl: string | undefined;
      let uploadedType: MediaType = "none";
      if (mediaFile) {
        const uploaded = await uploadCommunityMedia(mediaFile);
        uploadedUrl = uploaded.url;
        uploadedType = uploaded.mediaType;
      }
      const created = await createPost({
        body: postBody.trim() || (uploadedType === "video" ? "Shared a short clip" : "Shared a moment"),
        tag: postTag,
        authorName: user.fullName || "VetKonnect member",
        mediaUrl: uploadedUrl,
        mediaType: uploadedType,
      });
      setComposerOpen(false);
      setPostBody("");
      onPickMedia(null);
      setPostsData((prev) => [created, ...prev]);
      if (user.notificationsEnabled !== false) {
        toast.success("Posted to community", { description: "Your update is live." });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish post");
    } finally {
      setBusy(false);
    }
  };

  const sharePost = async (post: CommunityPost) => {
    const url = `${window.location.origin}/community/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "VetKonnect Community", text: post.body, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${post.body}\n${url}`);
        toast.success("Link copied");
      }
    } catch {
      // cancelled
    }
  };

  return (
    <AppShell>
      <ScreenHeader title="Community" subtitle="Learn, share and support animals near you." />

      <div className="flex gap-2 overflow-x-auto px-5 pb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-5 pb-28">
        {initialLoading ? <p className="text-sm text-muted-foreground">Loading posts…</p> : null}
        {!initialLoading && posts.length === 0 ? (
          <div className="card-surface p-8 text-center">
            <p className="font-bold">No posts in this category yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to share something.</p>
          </div>
        ) : null}

        {posts.map((post) => (
          <article key={post.id} className="card-surface overflow-hidden animate-in fade-in duration-300">
            <Link to="/community/$postId" params={{ postId: post.id }} className="block">
              <div className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-accent font-bold text-primary">
                  {(post.author || "V").charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{post.author}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.timeAgo} · {post.location}
                  </p>
                </div>
                <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground">
                  {post.tag}
                </span>
                <MoreHorizontal className="size-5 text-muted-foreground" />
              </div>
              <p className="px-4 pb-3 text-sm leading-relaxed">{post.body}</p>
            </Link>

            {post.mediaType === "video" && post.videoUrl ? (
              <video src={post.videoUrl} controls className="max-h-80 w-full bg-black object-contain" />
            ) : post.imageUrl ? (
              <button type="button" className="block w-full" onClick={() => setLightbox(post.imageUrl)}>
                <img src={post.imageUrl} alt="" loading="lazy" className="h-56 w-full object-cover" />
              </button>
            ) : null}

            <div className="flex items-center gap-5 px-4 py-3 text-sm text-muted-foreground">
              <button
                onClick={async () => {
                  try {
                    const updated = await toggleLike(post.id);
                    setPostsData((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not like post");
                  }
                }}
                className="flex cursor-pointer items-center gap-1.5"
              >
                <Heart className={cn("size-5", post.likedByMe && "fill-primary text-primary")} />
                {post.likes}
              </button>
              <button
                onClick={() => setActiveCommentsPost(post.id)}
                className="flex cursor-pointer items-center gap-1.5"
              >
                <MessageCircle className="size-5" /> {post.comments}
              </button>
              <Link to="/community/$postId" params={{ postId: post.id }} className="flex items-center gap-1.5">
                <Eye className="size-5" /> {post.views}
              </Link>
              <button onClick={() => void sharePost(post)} className="cursor-pointer">
                <Share2 className="size-5" />
              </button>
            </div>
          </article>
        ))}

        <div ref={sentinelRef} className="h-8 w-full" />
        {loadingMore ? <p className="pb-4 text-center text-sm text-muted-foreground">Loading more…</p> : null}
        {!hasMore && postsData.length > 0 ? (
          <p className="pb-4 text-center text-xs text-muted-foreground">You're caught up</p>
        ) : null}
      </div>

      <button
        onClick={() => setComposerOpen(true)}
        className="fixed bottom-28 right-[max(1.25rem,calc(50%-12.5rem+1.25rem))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)] transition-transform hover:scale-105"
        aria-label="Create post"
      >
        <Plus className="size-7" />
      </button>

      {composerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[398px] rounded-3xl bg-background p-5 shadow-[var(--shadow-float)] animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Create a post</h2>
              <button onClick={() => setComposerOpen(false)} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <textarea
              value={postBody}
              onChange={(e) => setPostBody(e.target.value)}
              placeholder="Share a story, breeding tip or rescue update…"
              className="mt-4 min-h-28 w-full rounded-2xl border border-border bg-card p-3 text-sm outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {(["Story", "Education", "Rescue", "Breeding"] as const).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setPostTag(tag)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold",
                    postTag === tag ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" /> Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.accept = "video/mp4,video/webm,video/quicktime";
                    fileRef.current.click();
                    fileRef.current.accept = "image/*,video/mp4,video/webm,video/quicktime";
                  }
                }}
              >
                <Video className="size-4" /> Short clip
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => onPickMedia(e.target.files?.[0] ?? null)}
            />
            {mediaPreview ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                {mediaType === "video" ? (
                  <video src={mediaPreview} controls className="max-h-48 w-full object-contain" />
                ) : (
                  <img src={mediaPreview} alt="" className="max-h-48 w-full object-cover" />
                )}
              </div>
            ) : null}
            <Button variant="hero" className="mt-4 w-full" disabled={busy} onClick={() => void publish()}>
              {busy ? "Publishing…" : "Post to community"}
            </Button>
          </div>
        </div>
      ) : null}

      {activeCommentsPost ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[75vh] w-full max-w-[398px] flex-col rounded-3xl bg-background p-5 shadow-[var(--shadow-float)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Comments</h2>
              <button onClick={() => setActiveCommentsPost(null)} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Be the first to comment.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-2xl bg-accent/40 p-3">
                    <p className="text-sm font-semibold">{c.authorName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 rounded-full border border-border bg-card px-4 py-3 text-sm outline-none"
              />
              <Button
                variant="hero"
                disabled={!commentDraft.trim()}
                onClick={async () => {
                  try {
                    const created = await addComment(
                      activeCommentsPost,
                      commentDraft,
                      user.fullName || "VetKonnect member",
                    );
                    setComments((prev) => [...prev, created]);
                    setCommentDraft("");
                    setPostsData((prev) =>
                      prev.map((p) => (p.id === activeCommentsPost ? { ...p, comments: p.comments + 1 } : p)),
                    );
                    toast.success("Comment added");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not comment");
                  }
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {lightbox ? <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} /> : null}
    </AppShell>
  );
}
