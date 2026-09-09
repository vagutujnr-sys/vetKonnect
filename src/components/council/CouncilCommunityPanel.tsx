import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { getPosts } from "@/services/contentService";
import type { CommunityPost } from "@/types";
import { cn } from "@/lib/utils";

const filters = ["All", "Story", "Education", "Rescue", "Breeding"] as const;
const PAGE_SIZE = 8;

export function CouncilCommunityPanel() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);

  const loadPage = useCallback(async (nextOffset: number, replace = false) => {
    if (lock.current) return;
    lock.current = true;
    try {
      const batch = await getPosts({ limit: PAGE_SIZE, offset: nextOffset });
      setPosts((prev) => (replace ? batch : [...prev, ...batch]));
      setOffset(nextOffset + batch.length);
      setHasMore(batch.length === PAGE_SIZE);
    } catch (error) {
      console.error(error);
      toast.error("Could not load community posts");
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(0, true);
  }, [loadPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore && !lock.current) {
        void loadPage(offset);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadPage, offset]);

  const visible = posts.filter((post) => filter === "All" || post.tag === filter);

  return (
    <div className="space-y-4 px-5 pb-8">
      <div>
        <h2 className="text-xl font-extrabold">Community</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read the VetKonnect feed. Publish official posts from the desktop dashboard.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
              filter === item ? "bg-teal-800 text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visible.map((post) => (
          <article key={post.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-900">
                {post.author.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{post.author}</p>
                <p className="text-xs text-muted-foreground">
                  {post.location} · {post.timeAgo}
                </p>
              </div>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {post.tag}
              </span>
            </div>
            <p className="whitespace-pre-wrap px-4 pb-3 text-sm leading-relaxed">{post.body}</p>
            {post.imageUrl ? (
              <img src={post.imageUrl} alt="" className="max-h-72 w-full object-cover" />
            ) : null}
            {post.videoUrl ? (
              <video src={post.videoUrl} controls className="max-h-72 w-full bg-black" />
            ) : null}
            <div className="flex gap-4 px-4 py-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3.5" /> {post.likes}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3.5" /> {post.comments}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye className="size-3.5" /> {post.views}
              </span>
            </div>
          </article>
        ))}
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts in this filter.</p>
        ) : null}
        <div ref={sentinelRef} className="h-4" />
      </div>
    </div>
  );
}
