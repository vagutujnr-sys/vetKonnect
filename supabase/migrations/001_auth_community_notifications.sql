-- Minimal auth, community engagement, and notifications upgrades
-- Compatible with live UUID ids on pets/community_posts

create extension if not exists "pgcrypto";

create table if not exists public.accounts (
  id text primary key,
  phone text not null unique,
  country_code text not null default '+263',
  full_name text not null default '',
  modules jsonb not null default '[]'::jsonb,
  onboarded boolean not null default false,
  vet_sure_member boolean not null default false,
  is_admin boolean not null default false,
  notifications_enabled boolean not null default true,
  otp_code text,
  otp_expires_at timestamptz,
  bound_device_id text,
  device_bound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accounts_phone_idx on public.accounts (phone);
create index if not exists accounts_bound_device_idx on public.accounts (bound_device_id);

alter table public.pets add column if not exists owner_id text;
alter table public.pets add column if not exists collar_id text;
create index if not exists pets_owner_id_idx on public.pets (owner_id);

alter table public.community_posts add column if not exists author_id text;
alter table public.community_posts add column if not exists media_type text not null default 'image';
alter table public.community_posts add column if not exists video_url text not null default '';
alter table public.community_posts add column if not exists liked_by jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.community_posts
    add constraint community_posts_media_type_check
    check (media_type in ('none', 'image', 'video'));
exception when duplicate_object then null;
end $$;

create table if not exists public.community_likes (
  id text primary key,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  account_id text not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, account_id)
);

create table if not exists public.community_comments (
  id text primary key,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  account_id text not null references public.accounts(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists community_comments_post_id_idx on public.community_comments (post_id, created_at desc);
create index if not exists community_likes_post_id_idx on public.community_likes (post_id);

create table if not exists public.notifications (
  id text primary key,
  account_id text not null references public.accounts(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'system',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_account_id_idx on public.notifications (account_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  true,
  52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public community media read" on storage.objects;
create policy "public community media read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'community-media');

drop policy if exists "public community media upload" on storage.objects;
create policy "public community media upload"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'community-media');

drop policy if exists "public community media update" on storage.objects;
create policy "public community media update"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'community-media')
  with check (bucket_id = 'community-media');

drop policy if exists "public community media delete" on storage.objects;
create policy "public community media delete"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'community-media');

alter table public.accounts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_comments enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "public accounts access" on public.accounts;
create policy "public accounts access" on public.accounts for all to anon, authenticated using (true) with check (true);
drop policy if exists "public community likes access" on public.community_likes;
create policy "public community likes access" on public.community_likes for all to anon, authenticated using (true) with check (true);
drop policy if exists "public community comments access" on public.community_comments;
create policy "public community comments access" on public.community_comments for all to anon, authenticated using (true) with check (true);
drop policy if exists "public notifications access" on public.notifications;
create policy "public notifications access" on public.notifications for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

notify pgrst, 'reload schema';
