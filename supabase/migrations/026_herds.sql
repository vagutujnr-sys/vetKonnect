-- Farm herds and the animals kept in each group.
-- A sick animal is identified by its herd plus tag number once a tag is assigned.

create table if not exists public.herds (
  id text primary key,
  owner_id text not null references public.accounts(id) on delete cascade,
  name text not null,
  species text not null,
  location text not null default '',
  notes text not null default '',
  photo_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists herds_owner_idx on public.herds (owner_id);

create table if not exists public.herd_animals (
  id text primary key,
  herd_id text not null references public.herds(id) on delete cascade,
  owner_id text not null references public.accounts(id) on delete cascade,
  tag_number text,
  sex text not null default 'Unknown',
  health_status text not null default 'Healthy',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.herd_animals
    add constraint herd_animals_sex_check
    check (sex in ('Male', 'Female', 'Unknown'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.herd_animals
    add constraint herd_animals_health_check
    check (health_status in ('Healthy', 'Sick', 'Under Care'));
exception when duplicate_object then null;
end $$;

create index if not exists herd_animals_herd_idx on public.herd_animals (herd_id);
create index if not exists herd_animals_owner_idx on public.herd_animals (owner_id);

create table if not exists public.herd_treatments (
  id text primary key,
  herd_id text not null references public.herds(id) on delete cascade,
  owner_id text not null references public.accounts(id) on delete cascade,
  animal_id text references public.herd_animals(id) on delete cascade,
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists herd_treatments_herd_idx on public.herd_treatments (herd_id, created_at desc);

create unique index if not exists herd_animals_tag_unique
  on public.herd_animals (herd_id, tag_number)
  where tag_number is not null and btrim(tag_number) <> '';

alter table public.herds enable row level security;
alter table public.herd_animals enable row level security;
alter table public.herd_treatments enable row level security;

drop policy if exists "public herds access" on public.herds;
create policy "public herds access" on public.herds
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public herd animals access" on public.herd_animals;
create policy "public herd animals access" on public.herd_animals
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "public herd treatments access" on public.herd_treatments;
create policy "public herd treatments access" on public.herd_treatments
  for all to anon, authenticated using (true) with check (true);

grant all on public.herds to anon, authenticated, service_role;
grant all on public.herd_animals to anon, authenticated, service_role;
grant all on public.herd_treatments to anon, authenticated, service_role;

notify pgrst, 'reload schema';
