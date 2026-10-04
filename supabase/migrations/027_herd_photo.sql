-- Herd cover photo. Safe if 026 was already applied without this column.

alter table public.herds
  add column if not exists photo_url text not null default '';

notify pgrst, 'reload schema';
