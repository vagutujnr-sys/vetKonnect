-- Breeders Club membership, status tracking, and showcase pet support.

alter table public.accounts
  add column if not exists breeders_club_member boolean not null default false,
  add column if not exists breeders_club_status text not null default 'none',
  add column if not exists breeder_showcase_pet_id text;

do $$ begin
  alter table public.accounts
    add constraint accounts_breeders_club_status_check
    check (breeders_club_status in ('none', 'pending', 'active', 'expired', 'cancelled', 'suspended'));
exception when duplicate_object then null;
end $$;

create index if not exists accounts_breeders_club_member_idx
  on public.accounts (breeders_club_member);

create index if not exists accounts_breeders_club_status_idx
  on public.accounts (breeders_club_status);

create table if not exists public.breeder_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id text not null unique references public.accounts(id) on delete cascade,
  breeder_name text not null default '',
  showcase_pet_id text,
  membership_status text not null default 'none' check (membership_status in ('none', 'pending', 'active', 'expired', 'cancelled', 'suspended')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists breeder_profiles_account_id_idx
  on public.breeder_profiles (account_id);

create index if not exists breeder_profiles_membership_status_idx
  on public.breeder_profiles (membership_status);

alter table public.breeder_profiles enable row level security;

drop policy if exists "public breeder profiles access" on public.breeder_profiles;
create policy "public breeder profiles access"
  on public.breeder_profiles for all to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';