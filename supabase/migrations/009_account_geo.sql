-- Optional owner / account map coordinates for Impact

alter table public.accounts
  add column if not exists latitude double precision;

alter table public.accounts
  add column if not exists longitude double precision;

create index if not exists accounts_geo_idx on public.accounts (latitude, longitude)
  where latitude is not null and longitude is not null;

notify pgrst, 'reload schema';
