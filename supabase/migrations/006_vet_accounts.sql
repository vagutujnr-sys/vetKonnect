-- Vet account type + admin verification for practice features

alter table public.accounts
  add column if not exists account_type text not null default 'owner';

alter table public.accounts
  add column if not exists vet_verified boolean not null default false;

alter table public.accounts
  add column if not exists practice_name text not null default '';

alter table public.accounts
  add column if not exists patients_served integer not null default 0;

do $$ begin
  alter table public.accounts
    add constraint accounts_account_type_check
    check (account_type in ('owner', 'vet'));
exception when duplicate_object then null;
end $$;

create index if not exists accounts_account_type_idx on public.accounts (account_type);

notify pgrst, 'reload schema';
