-- Replies on community comments. A null parent_id is a comment on the post.

alter table public.community_comments
  add column if not exists parent_id text references public.community_comments(id) on delete cascade;

create index if not exists community_comments_parent_idx
  on public.community_comments (parent_id, created_at);

notify pgrst, 'reload schema';
