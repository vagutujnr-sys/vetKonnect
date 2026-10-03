-- 5-digit account PIN. Replaces device binding for owner and vet sign-in.

alter table public.accounts
  add column if not exists pin_hash text;

notify pgrst, 'reload schema';
