-- City Council animal-control dashboard
-- Separate email/password officials + municipal registries
-- pet_id must be uuid to match public.pets(id)

create table if not exists public.council_accounts (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists council_accounts_email_idx on public.council_accounts (lower(email));
create index if not exists council_accounts_active_idx on public.council_accounts (active);

create table if not exists public.pet_licences (
  id text primary key,
  pet_id uuid references public.pets(id) on delete set null,
  licence_number text not null unique,
  owner_name text,
  pet_name text,
  species text,
  issued_at date not null,
  expires_at date not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists pet_licences_status_idx on public.pet_licences (status);
create index if not exists pet_licences_expires_idx on public.pet_licences (expires_at);
create index if not exists pet_licences_pet_id_idx on public.pet_licences (pet_id);

create table if not exists public.animal_control_cases (
  id text primary key,
  case_type text not null check (case_type in ('lost', 'found', 'impound', 'incident')),
  status text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  title text not null,
  description text,
  species text,
  pet_id uuid references public.pets(id) on delete set null,
  pet_name text,
  location_label text,
  latitude double precision,
  longitude double precision,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  reported_by text,
  created_at timestamptz not null default now()
);

create index if not exists animal_control_cases_type_idx on public.animal_control_cases (case_type);
create index if not exists animal_control_cases_status_idx on public.animal_control_cases (status);
create index if not exists animal_control_cases_reported_idx on public.animal_control_cases (reported_at desc);

alter table public.council_accounts enable row level security;
alter table public.pet_licences enable row level security;
alter table public.animal_control_cases enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'council_accounts' and policyname = 'council_accounts_all'
  ) then
    create policy council_accounts_all on public.council_accounts for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'pet_licences' and policyname = 'pet_licences_all'
  ) then
    create policy pet_licences_all on public.pet_licences for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'animal_control_cases' and policyname = 'animal_control_cases_all'
  ) then
    create policy animal_control_cases_all on public.animal_control_cases for all using (true) with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
