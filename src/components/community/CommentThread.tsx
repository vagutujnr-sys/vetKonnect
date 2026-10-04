import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addComment } from "@/services/contentService";
import type { CommunityComment } from "@/types";

function AuthorName({ name, premium }: { name: string; premium?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {premium ? <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Premium" /> : null}
      <span className="truncate">{name}</span>
    </span>
  );
}

export function CommentThread({
  postId,
  comments,
  authorName,
  limit,
  className,
  onCommented,
}: {
  postId: string;
  comments: CommunityComment[];
  authorName: string;
  limit?: number;
  className?: string;
  onCommented: (comment: CommunityComment) => void;
}) {
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const roots = comments
    .filter((comment) => !comment.parentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const visibleRoots = limit ? roots.slice(-limit) : roots;

  const submitReply = async () => {
    if (!replyTo || !draft.trim()) return;
    setBusy(true);
    try {
      const created = await addComment(postId, draft, authorName, replyTo.id);
      onCommented(created);
      setDraft("");
      setReplyTo(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reply");
    } finally {
      setBusy(false);
    }
  };

  const renderComment = (comment: CommunityComment, depth = 0) => {
    const replies = comments
      .filter((item) => item.parentId === comment.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return (
      <div key={comment.id} className={depth ? "ml-5 border-l border-border pl-3" : ""}>
        <p className="text-sm">
          <span className="font-semibold">
            <AuthorName name={comment.authorName} premium={comment.authorPremium} />
          </span>{" "}
          <span className="text-muted-foreground">{comment.body}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setReplyTo(comment);
            setDraft("");
          }}
          className="mt-1 text-xs font-semibold text-muted-foreground"
        >
          Reply
        </button>
        {replyTo?.id === comment.id ? (
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Reply to ${comment.authorName}`}
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none"
            />
            <Button type="button" variant="hero" size="sm" disabled={busy || !draft.trim()} onClick={() => void submitReply()}>
              {busy ? "…" : "Reply"}
            </Button>
          </div>
        ) : null}
        {replies.length > 0 ? <div className="mt-2 space-y-2">{replies.map((reply) => renderComment(reply, depth + 1))}</div> : null}
      </div>
    );
  };

  if (visibleRoots.length === 0) return null;

  return <div className={cn("space-y-3", className)}>{visibleRoots.map((comment) => renderComment(comment))}</div>;
}
