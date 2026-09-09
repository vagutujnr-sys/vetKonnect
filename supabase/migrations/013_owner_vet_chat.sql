-- Owner ↔ vet in-app chat

create table if not exists public.conversations (
  id text primary key,
  owner_account_id text not null references public.accounts(id) on delete cascade,
  vet_account_id text not null references public.accounts(id) on delete cascade,
  surgery_id text references public.vets(id) on delete set null,
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_account_id, vet_account_id)
);

create index if not exists conversations_owner_idx
  on public.conversations (owner_account_id, last_message_at desc);
create index if not exists conversations_vet_idx
  on public.conversations (vet_account_id, last_message_at desc);

create table if not exists public.messages (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender_account_id text not null references public.accounts(id) on delete cascade,
  body text not null,
  read_by_recipient boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at asc);
create index if not exists messages_unread_idx
  on public.messages (conversation_id, read_by_recipient)
  where read_by_recipient = false;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'conversations' and policyname = 'conversations_all'
  ) then
    create policy conversations_all on public.conversations for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname = 'messages_all'
  ) then
    create policy messages_all on public.messages for all using (true) with check (true);
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
