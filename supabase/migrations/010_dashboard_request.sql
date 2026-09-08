-- Track when a vet requests practice / professional dashboard access

alter table public.accounts
  add column if not exists dashboard_requested_at timestamptz;

create index if not exists accounts_dashboard_requested_idx
  on public.accounts (dashboard_requested_at desc)
  where dashboard_requested_at is not null;

notify pgrst, 'reload schema';
