-- Link app vet accounts to directory surgeries (public.vets)

alter table public.accounts
  add column if not exists surgery_id text references public.vets(id) on delete set null;

create index if not exists accounts_surgery_id_idx on public.accounts (surgery_id);

notify pgrst, 'reload schema';
