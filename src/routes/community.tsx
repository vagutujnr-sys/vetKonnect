import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Share2 } from "lucide-react";
import { useState } from "react";
import { AppShell, ScreenHeader } from "@/components/layout/AppShell";
import { mockPosts } from "@/data/mockCommunity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — VetConnect Pets" },
      { name: "description", content: "Stories, rescue updates and veterinary education from the animal community." },
      { property: "og:title", content: "Community — VetConnect Pets" },
      { property: "og:description", content: "Connect with animal lovers and learn from veterinary professionals." },
    ],
  }),
  component: Community,
});

const filters = ["All", "Story", "Education", "Rescue"] as const;

function Community() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [liked, setLiked] = useState<string[]>([]);
  const posts = filter === "All" ? mockPosts : mockPosts.filter((p) => p.tag === filter);

  const toggleLike = (id: string) =>
    setLiked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  return (
    <AppShell>
      <ScreenHeader title="Community" subtitle="Learn, share and support animals near you." />

      <div className="flex gap-2 overflow-x-auto px-5 pb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-5">
        {posts.map((post) => {
          const isLiked = liked.includes(post.id);
          return (
            <article key={post.id} className="card-surface overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <img src={post.avatarUrl} alt="" loading="lazy" className="size-10 rounded-full object-cover" />
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
              <img src={post.imageUrl} alt="" loading="lazy" className="h-56 w-full object-cover" />
              <div className="flex items-center gap-6 px-4 py-3 text-sm text-muted-foreground">
                <button onClick={() => toggleLike(post.id)} className="flex cursor-pointer items-center gap-1.5">
                  <Heart className={cn("size-5", isLiked && "fill-primary text-primary")} />
                  {post.likes + (isLiked ? 1 : 0)}
                </button>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="size-5" /> {post.comments}
                </span>
                <Share2 className="size-5" />
                <Bookmark className="ml-auto size-5" />
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
