import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/community/ImageLightbox";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { addComment, getComments, getPostById, recordPostView, toggleLike } from "@/services/contentService";
import type { CommunityComment, CommunityPost } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/community/$postId")({
  head: () => ({
    meta: [
      { title: "Post — VetKonnect Community" },
      { name: "description", content: "Read a VetKonnect community post and join the conversation." },
    ],
  }),
  component: PostDetailPage,
});

function PostDetailPage() {
  const { postId } = Route.useParams();
  const { user } = useApp();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const found = await getPostById(postId);
        if (!alive) return;
        if (!found) {
          setMissing(true);
          return;
        }
        setPost(found);
        const viewed = await recordPostView(postId, user.fullName);
        if (alive && viewed) setPost(viewed);
        setComments(await getComments(postId));
      } catch (error) {
        console.error(error);
        toast.error("Could not open this post");
        if (alive) setMissing(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [postId, user.fullName]);

  if (loading) {
    return (
      <AppShell>
        <div className="px-5 pt-16 text-sm text-muted-foreground">Loading post…</div>
      </AppShell>
    );
  }

  if (missing || !post) {
    return (
      <AppShell>
        <div className="px-5 pt-16 text-center">
          <p className="font-bold">Post not found</p>
          <Button asChild variant="hero" className="mt-4">
            <Link to="/community">Back to community</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-center gap-3 px-5 pb-3 pt-8">
        <Link
          to="/community"
          className="flex size-10 items-center justify-center rounded-full border border-border"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold">Community post</h1>
          <p className="text-sm text-muted-foreground">{post.tag}</p>
        </div>
      </header>

      <article className="px-5 pb-10">
        <div className="card-surface overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <div className="flex size-11 items-center justify-center rounded-full bg-accent font-bold text-primary">
              {(post.author || "V").charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold">{post.author}</p>
              <p className="text-xs text-muted-foreground">
                {post.timeAgo} · {post.location}
              </p>
            </div>
            <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground">
              {post.tag}
            </span>
          </div>

          <p className="px-4 pb-4 text-[15px] leading-relaxed">{post.body}</p>

          {post.mediaType === "video" && post.videoUrl ? (
            <video src={post.videoUrl} controls className="max-h-[420px] w-full bg-black object-contain" />
          ) : post.imageUrl ? (
            <button type="button" className="block w-full" onClick={() => setLightbox(post.imageUrl)}>
              <img src={post.imageUrl} alt="" className="max-h-[420px] w-full object-cover" />
            </button>
          ) : null}

          <div className="flex items-center gap-5 px-4 py-4 text-sm text-muted-foreground">
            <button
              className="flex items-center gap-1.5"
              onClick={async () => {
                try {
                  setPost(await toggleLike(post.id));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not like post");
                }
              }}
            >
              <Heart className={cn("size-5", post.likedByMe && "fill-primary text-primary")} />
              {post.likes}
            </button>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="size-5" /> {post.comments}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="size-5" /> {post.views}
            </span>
            <button
              className="ml-auto"
              onClick={async () => {
                try {
                  if (navigator.share) {
                    await navigator.share({ title: post.author, text: post.body, url: window.location.href });
                  } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied");
                  }
                } catch {
                  // cancelled
                }
              }}
            >
              <Share2 className="size-5" />
            </button>
          </div>
        </div>

        <section className="mt-5">
          <h2 className="text-lg font-bold">Comments</h2>
          <div className="mt-3 space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-2xl bg-accent/40 p-3">
                <p className="text-sm font-semibold">{c.authorName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
              </div>
            ))}
            {comments.length === 0 ? <p className="text-sm text-muted-foreground">Be the first to comment.</p> : null}
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
                  const created = await addComment(post.id, commentDraft, user.fullName || "VetKonnect member");
                  setComments((prev) => [...prev, created]);
                  setCommentDraft("");
                  setPost((prev) => (prev ? { ...prev, comments: prev.comments + 1 } : prev));
                  toast.success("Comment added");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not comment");
                }
              }}
            >
              Send
            </Button>
          </div>
        </section>
      </article>

      {lightbox ? <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} /> : null}
    </AppShell>
  );
}
