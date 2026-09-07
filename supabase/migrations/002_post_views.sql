-- Post views + unique view tracking for read notifications

alter table public.community_posts add column if not exists views integer not null default 0;

create table if not exists public.community_views (
  id text primary key,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  account_id text not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, account_id)
);

create index if not exists community_views_post_id_idx on public.community_views (post_id);

alter table public.community_views enable row level security;
drop policy if exists "public community views access" on public.community_views;
create policy "public community views access" on public.community_views for all to anon, authenticated using (true) with check (true);

grant all on table public.community_views to anon, authenticated, service_role;
notify pgrst, 'reload schema';
