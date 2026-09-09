-- In-app WebRTC voice calls (no PSTN / no number reveal)

create table if not exists public.call_sessions (
  id text primary key,
  caller_account_id text not null references public.accounts(id) on delete cascade,
  callee_account_id text not null references public.accounts(id) on delete cascade,
  surgery_id text references public.vets(id) on delete set null,
  status text not null default 'ringing'
    check (status in ('ringing', 'accepted', 'active', 'ended', 'rejected', 'missed')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);

create index if not exists call_sessions_callee_status_idx
  on public.call_sessions (callee_account_id, status, created_at desc);
create index if not exists call_sessions_caller_idx
  on public.call_sessions (caller_account_id, created_at desc);

alter table public.call_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'call_sessions' and policyname = 'call_sessions_all'
  ) then
    create policy call_sessions_all on public.call_sessions for all using (true) with check (true);
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.call_sessions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
