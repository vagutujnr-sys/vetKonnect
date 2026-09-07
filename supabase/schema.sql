create extension if not exists "pgcrypto";

create table if not exists public.app_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id text primary key,
  full_name text not null,
  phone text not null,
  country text not null default 'Zimbabwe',
  onboarded boolean not null default false,
  pets integer not null default 0,
  subscriptions jsonb not null default '[]'::jsonb,
  pet_ids jsonb not null default '[]'::jsonb,
  member_since text,
  vet_sure_member boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.vets (
  id text primary key,
  name text not null,
  surgery text not null,
  location text not null,
  phone text not null,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  rating numeric(2,1) not null default 0,
  latitude numeric,
  longitude numeric,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.pets (
  id text primary key,
  vetconnect_id text not null unique,
  collar_id text,
  name text not null,
  species text not null,
  breed text not null,
  sex text not null,
  age_years numeric not null default 0,
  colour text not null,
  microchip text,
  photo_url text not null default '',
  health_status text not null default 'Healthy',
  weight_kg numeric not null default 0,
  next_vaccine text not null default 'Not scheduled',
  medication_today text not null default 'None Today',
  vet_sure boolean not null default false,
  timeline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id text primary key,
  name text not null,
  category text not null,
  distance_km numeric not null default 0,
  rating numeric(2,1) not null default 0,
  address text not null,
  latitude numeric not null,
  longitude numeric not null,
  open boolean not null default false,
  image_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.services add column if not exists distance_km numeric not null default 0;
alter table public.services add column if not exists rating numeric(2,1) not null default 0;
alter table public.services add column if not exists address text not null default '';
alter table public.services add column if not exists latitude numeric not null default 0;
alter table public.services add column if not exists longitude numeric not null default 0;
alter table public.services add column if not exists open boolean not null default false;
alter table public.services add column if not exists image_url text not null default '';

create table if not exists public.community_posts (
  id text primary key,
  author text not null,
  location text not null,
  time_ago text not null,
  avatar_url text not null default '',
  image_url text not null default '',
  body text not null,
  likes integer not null default 0,
  comments integer not null default 0,
  tag text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pet_tags (
  id text primary key,
  type text not null check (type in ('Collar ID', 'Pet Tag')),
  prefix text not null,
  code text not null unique,
  qr_data_url text not null,
  created_at timestamptz not null default now()
);

alter table public.app_storage enable row level security;
alter table public.users enable row level security;
alter table public.vets enable row level security;
alter table public.pets enable row level security;
alter table public.services enable row level security;
alter table public.community_posts enable row level security;
alter table public.pet_tags enable row level security;

drop policy if exists "public app storage access" on public.app_storage;
create policy "public app storage access" on public.app_storage for all to anon, authenticated using (true) with check (true);
drop policy if exists "public users access" on public.users;
create policy "public users access" on public.users for all to anon, authenticated using (true) with check (true);
drop policy if exists "public vets access" on public.vets;
create policy "public vets access" on public.vets for all to anon, authenticated using (true) with check (true);
drop policy if exists "public pets access" on public.pets;
create policy "public pets access" on public.pets for all to anon, authenticated using (true) with check (true);
drop policy if exists "public services access" on public.services;
create policy "public services access" on public.services for all to anon, authenticated using (true) with check (true);
drop policy if exists "public community posts access" on public.community_posts;
create policy "public community posts access" on public.community_posts for all to anon, authenticated using (true) with check (true);
drop policy if exists "public pet tags access" on public.pet_tags;
create policy "public pet tags access" on public.pet_tags for all to anon, authenticated using (true) with check (true);

-- See also: supabase/migrations/001_auth_community_notifications.sql
-- (accounts, device binding, community likes/comments, notifications, media bucket)
