-- Allow admins to block app accounts (owners and vets)

alter table public.accounts
  add column if not exists blocked boolean not null default false;

create index if not exists accounts_blocked_idx on public.accounts (blocked);

notify pgrst, 'reload schema';
