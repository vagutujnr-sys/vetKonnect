-- Treatment notes for a whole herd or one tagged animal.

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

alter table public.herd_treatments enable row level security;

drop policy if exists "public herd treatments access" on public.herd_treatments;
create policy "public herd treatments access" on public.herd_treatments
  for all to anon, authenticated using (true) with check (true);

grant all on public.herd_treatments to anon, authenticated, service_role;

notify pgrst, 'reload schema';
