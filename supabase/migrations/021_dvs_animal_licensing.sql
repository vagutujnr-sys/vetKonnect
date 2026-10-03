-- DVS national animal licensing and Paynow payments.

create table if not exists public.dvs_animal_licences (
  id text primary key,
  licence_number text not null unique,
  pet_id uuid references public.pets(id) on delete set null,
  owner_account_id text,
  owner_name text,
  owner_phone text,
  pet_name text,
  species text,
  sex text,
  issued_at date not null,
  expires_at date not null,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  payment_id text,
  issued_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dvs_animal_licences_pet_idx on public.dvs_animal_licences (pet_id);
create index if not exists dvs_animal_licences_status_idx on public.dvs_animal_licences (status);
create index if not exists dvs_animal_licences_owner_idx on public.dvs_animal_licences (owner_account_id);
create index if not exists dvs_animal_licences_expires_idx on public.dvs_animal_licences (expires_at);

create table if not exists public.dvs_licence_payments (
  id text primary key,
  reference text not null unique,
  pet_id uuid references public.pets(id) on delete set null,
  owner_account_id text,
  licence_id text references public.dvs_animal_licences(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  method text not null default 'paynow' check (method in ('paynow', 'ecocash', 'onemoney', 'office')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'failed')),
  phone text,
  poll_url text,
  redirect_url text,
  instructions text,
  paynow_status text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dvs_licence_payments_status_idx on public.dvs_licence_payments (status, created_at desc);
create index if not exists dvs_licence_payments_pet_idx on public.dvs_licence_payments (pet_id);
create index if not exists dvs_licence_payments_owner_idx on public.dvs_licence_payments (owner_account_id);

insert into public.dvs_settings (key, value)
values
  ('licence_fee_dog', '8'::jsonb),
  ('licence_fee_cat', '5'::jsonb),
  ('licence_fee_other', '6'::jsonb),
  ('licence_currency', '"USD"'::jsonb)
on conflict (key) do nothing;

alter table public.dvs_animal_licences enable row level security;
alter table public.dvs_licence_payments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_animal_licences' and policyname = 'dvs_animal_licences_all') then
    create policy dvs_animal_licences_all on public.dvs_animal_licences for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_licence_payments' and policyname = 'dvs_licence_payments_all') then
    create policy dvs_licence_payments_all on public.dvs_licence_payments for all using (true) with check (true);
  end if;
end
$$;
