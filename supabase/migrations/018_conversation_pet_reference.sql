-- Align owner↔vet conversations to a referenced pet
-- pets.id is uuid in this project — pet_id must match.

alter table public.conversations
  drop constraint if exists conversations_pet_id_fkey;

alter table public.conversations
  drop column if exists pet_id;

alter table public.conversations
  add column pet_id uuid references public.pets(id) on delete set null;

create index if not exists conversations_pet_id_idx
  on public.conversations (pet_id)
  where pet_id is not null;

notify pgrst, 'reload schema';
