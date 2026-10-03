-- Private Breeders Club feed. Access this data through trusted server-side code.

create table if not exists public.breeder_community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null references public.accounts(id) on delete cascade,
  body text not null default '',
  media_type text not null default 'none'
    check (media_type in ('none', 'image', 'video')),
  media_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists breeder_community_posts_created_at_idx
  on public.breeder_community_posts (created_at desc);

create index if not exists breeder_community_posts_author_id_idx
  on public.breeder_community_posts (author_id, created_at desc);

create table if not exists public.breeder_community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.breeder_community_posts(id) on delete cascade,
  account_id text not null references public.accounts(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists breeder_community_comments_post_id_idx
  on public.breeder_community_comments (post_id, created_at);

create table if not exists public.breeder_community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.breeder_community_posts(id) on delete cascade,
  account_id text not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, account_id)
);

create index if not exists breeder_community_likes_post_id_idx
  on public.breeder_community_likes (post_id);

create or replace function public.require_active_breeder_for_community_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  writer_id text;
begin
  writer_id := case
    when tg_table_name = 'breeder_community_posts' then new.author_id
    else new.account_id
  end;

  if not exists (
    select 1
    from public.accounts
    where id = writer_id
      and breeders_club_member = true
      and breeders_club_status = 'active'
  ) then
    raise exception 'An active Breeders Club membership is required';
  end if;

  return new;
end;
$$;

drop trigger if exists breeder_community_posts_active_writer on public.breeder_community_posts;
create trigger breeder_community_posts_active_writer
  before insert or update of author_id on public.breeder_community_posts
  for each row execute function public.require_active_breeder_for_community_write();

drop trigger if exists breeder_community_comments_active_writer on public.breeder_community_comments;
create trigger breeder_community_comments_active_writer
  before insert or update of account_id on public.breeder_community_comments
  for each row execute function public.require_active_breeder_for_community_write();

drop trigger if exists breeder_community_likes_active_writer on public.breeder_community_likes;
create trigger breeder_community_likes_active_writer
  before insert or update of account_id on public.breeder_community_likes
  for each row execute function public.require_active_breeder_for_community_write();

alter table public.breeder_community_posts enable row level security;
alter table public.breeder_community_comments enable row level security;
alter table public.breeder_community_likes enable row level security;

revoke all on public.breeder_community_posts from anon, authenticated;
revoke all on public.breeder_community_comments from anon, authenticated;
revoke all on public.breeder_community_likes from anon, authenticated;
grant all on public.breeder_community_posts to service_role;
grant all on public.breeder_community_comments to service_role;
grant all on public.breeder_community_likes to service_role;

drop policy if exists "service role breeder community posts access" on public.breeder_community_posts;
create policy "service role breeder community posts access"
  on public.breeder_community_posts for all to service_role
  using (true) with check (true);

drop policy if exists "service role breeder community comments access" on public.breeder_community_comments;
create policy "service role breeder community comments access"
  on public.breeder_community_comments for all to service_role
  using (true) with check (true);

drop policy if exists "service role breeder community likes access" on public.breeder_community_likes;
create policy "service role breeder community likes access"
  on public.breeder_community_likes for all to service_role
  using (true) with check (true);

notify pgrst, 'reload schema';
