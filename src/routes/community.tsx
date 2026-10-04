import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Clapperboard,
  Eye,
  BadgeCheck,
  Heart,
  ImagePlus,
  MessageCircle,
  Plus,
  Share2,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CommentThread } from "@/components/community/CommentThread";
import { ImageLightbox } from "@/components/community/ImageLightbox";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import {
  addComment,
  createPost,
  deletePost,
  getComments,
  getCommentsForPosts,
  getPosts,
  recordPostView,
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
  component: CommunityPage,
});

function CommunityPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/community") return <Outlet />;
  return <Community />;
}

const filters = ["All", "Story", "Education", "Rescue", "Breeding"] as const;
const PAGE_SIZE = 6;

function Community() {
  const { user } = useApp();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [postsData, setPostsData] = useState<CommunityPost[]>([]);
  const [threadComments, setThreadComments] = useState<Record<string, CommunityComment[]>>({});
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingLock = useRef(false);
  const countedViews = useRef(new Set<string>());

  const loadPage = useCallback(async (nextOffset: number, replace = false) => {
    if (loadingLock.current) return;
    loadingLock.current = true;
    setLoadingMore(true);
    try {
      const batch = await getPosts({ limit: PAGE_SIZE, offset: nextOffset });
      const comments = await getCommentsForPosts(batch.map((post) => post.id)).catch(() => [] as CommunityComment[]);
      setPostsData((prev) => (replace ? batch : [...prev, ...batch]));
      setThreadComments((prev) => {
        const next = replace ? {} : { ...prev };
        for (const post of batch) next[post.id] = comments.filter((comment) => comment.postId === post.id);
        return next;
      });
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
      .then((next) => {
        setComments(next);
        setThreadComments((prev) => ({ ...prev, [activeCommentsPost]: next }));
      })
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

  const removePost = async (post: CommunityPost) => {
    if (!user.id || post.authorId !== user.id) return;
    setDeletingId(post.id);
    try {
      await deletePost(post.id);
      setPostsData((prev) => prev.filter((item) => item.id !== post.id));
      setConfirmDeleteId(null);
      if (activeCommentsPost === post.id) setActiveCommentsPost(null);
      toast.success("Post deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete that post");
    } finally {
      setDeletingId(null);
    }
  };

  const countVideoView = async (post: CommunityPost) => {
    if (countedViews.current.has(post.id)) return;
    countedViews.current.add(post.id);
    try {
      const viewed = await recordPostView(post.id, user.fullName);
      if (!viewed) return;
      setPostsData((prev) => prev.map((item) => (item.id === post.id ? { ...item, views: viewed.views } : item)));
    } catch (error) {
      countedViews.current.delete(post.id);
      console.error(error);
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
    <AppShell scrollClassName="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ScreenHeader
        title="Community"
        subtitle="Learn, share and support animals near you."
        action={
          <Link
            to="/community/clips"
            aria-label="Clips"
            className="flex size-10 items-center justify-center"
          >
            <Clapperboard className="size-5" />
          </Link>
        }
      >
        <div className="mt-2 flex gap-1.5 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "cursor-pointer whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </ScreenHeader>

      <div className="space-y-2 pb-8">
        {initialLoading ? <p className="px-5 text-sm text-muted-foreground">Loading posts…</p> : null}
        {!initialLoading && posts.length === 0 ? (
          <div className="mx-5 rounded-md bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <p className="font-bold">No posts in this category yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to share something.</p>
          </div>
        ) : null}

        {posts.map((post) => {
          const ownsPost = Boolean(user.id && post.authorId === user.id);
          return (
          <article key={post.id} className="overflow-hidden rounded-md bg-card shadow-[var(--shadow-card)] animate-in fade-in duration-300">
            <div className="flex items-center gap-3 p-4">
              <Link to="/community/$postId" params={{ postId: post.id }} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-primary">
                  {(post.author || "V").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold">
                    {post.authorPremium ? (
                      <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Premium" />
                    ) : null}
                    <span className="truncate">{post.author}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {post.timeAgo} · {post.location}
                  </p>
                </div>
              </Link>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                {post.tag}
              </span>
              {ownsPost ? (
                <button
                  type="button"
                  aria-label="Delete post"
                  onClick={() => setConfirmDeleteId(post.id)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
            {confirmDeleteId === post.id ? (
              <div className="flex items-center justify-between gap-3 px-4 pb-3">
                <p className="text-sm font-medium">Delete this post?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === post.id}
                    onClick={() => void removePost(post)}
                    className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  >
                    {deletingId === post.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ) : null}
            <Link to="/community/$postId" params={{ postId: post.id }} className="block">
              <p className="px-4 pb-3 text-sm leading-relaxed">{post.body}</p>
            </Link>

            {post.mediaType === "video" && post.videoUrl ? (
              <video
                src={post.videoUrl}
                controls
                playsInline
                onPlay={() => void countVideoView(post)}
                className="max-h-80 w-full bg-black object-contain"
              />
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
                <Heart className={cn("size-5", post.likedByMe && "fill-red-500 text-red-500")} />
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
            <CommentThread
              postId={post.id}
              comments={threadComments[post.id] ?? []}
              authorName={user.fullName || "VetKonnect member"}
              limit={2}
              className="px-4 pb-3"
              onCommented={(created) => {
                setThreadComments((prev) => ({
                  ...prev,
                  [post.id]: [...(prev[post.id] ?? []), created],
                }));
                setPostsData((prev) =>
                  prev.map((item) => (item.id === post.id ? { ...item, comments: item.comments + 1 } : item)),
                );
              }}
            />
          </article>
          );
        })}

        <div ref={sentinelRef} className="h-8 w-full" />
        {loadingMore ? <p className="pb-4 text-center text-sm text-muted-foreground">Loading more…</p> : null}
        {!hasMore && postsData.length > 0 ? (
          <p className="pb-4 text-center text-xs text-muted-foreground">You're caught up</p>
        ) : null}
      </div>

      <button
        onClick={() => setComposerOpen(true)}
        className="fixed bottom-[calc(7.2rem+env(safe-area-inset-bottom))] right-[max(0.75rem,calc(50%-215px+0.75rem))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)] transition-transform hover:scale-105"
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
              className="mt-4 min-h-28 w-full rounded-2xl border border-border bg-card p-3 text-base outline-none"
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
            <div className="mt-4 flex-1 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Be the first to comment.</p>
              ) : (
                <CommentThread
                  postId={activeCommentsPost}
                  comments={comments}
                  authorName={user.fullName || "VetKonnect member"}
                  onCommented={(created) => {
                    setComments((prev) => [...prev, created]);
                    setThreadComments((prev) => ({
                      ...prev,
                      [activeCommentsPost]: [...(prev[activeCommentsPost] ?? []), created],
                    }));
                    setPostsData((prev) =>
                      prev.map((item) =>
                        item.id === activeCommentsPost ? { ...item, comments: item.comments + 1 } : item,
                      ),
                    );
                  }}
                />
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 rounded-full border border-border bg-card px-4 py-3 text-base outline-none"
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
                    setThreadComments((prev) => ({
                      ...prev,
                      [activeCommentsPost]: [...(prev[activeCommentsPost] ?? []), created],
                    }));
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
