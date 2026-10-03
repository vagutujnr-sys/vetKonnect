-- Department of Veterinary Services (DVS) national animal-health dashboard
-- Links official certificates / vaccinations to existing pets, accounts, and surgeries.

create table if not exists public.dvs_accounts (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  title text,
  role text not null default 'officer' check (role in ('officer', 'supervisor', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index if not exists dvs_accounts_email_idx on public.dvs_accounts (lower(email));
create index if not exists dvs_accounts_active_idx on public.dvs_accounts (active);

create table if not exists public.dvs_vaccine_batches (
  id text primary key,
  manufacturer text not null,
  batch_number text not null unique,
  vaccine_name text not null default 'Rabies vaccine',
  expiry_date date,
  quantity_received integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dvs_vaccine_batches_manufacturer_idx on public.dvs_vaccine_batches (manufacturer);

create table if not exists public.dvs_vaccinations (
  id text primary key,
  pet_id uuid references public.pets(id) on delete set null,
  owner_account_id text,
  veterinarian_account_id text,
  practice_id text,
  batch_id text references public.dvs_vaccine_batches(id) on delete set null,
  vaccinated_at date not null,
  valid_until date,
  province text,
  district text,
  status text not null default 'administered' check (status in ('administered', 'scheduled', 'void')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dvs_vaccinations_pet_idx on public.dvs_vaccinations (pet_id);
create index if not exists dvs_vaccinations_date_idx on public.dvs_vaccinations (vaccinated_at desc);
create index if not exists dvs_vaccinations_province_idx on public.dvs_vaccinations (province);

create table if not exists public.dvs_certificates (
  id text primary key,
  certificate_number text not null unique,
  verification_code text not null unique,
  pet_id uuid references public.pets(id) on delete set null,
  owner_account_id text,
  vaccination_id text references public.dvs_vaccinations(id) on delete set null,
  veterinarian_account_id text,
  practice_id text,
  issued_by_dvs_id text,
  issued_at date not null,
  expires_at date not null,
  status text not null default 'valid' check (status in ('valid', 'expired', 'cancelled', 'amended', 'suspicious')),
  previous_certificate_id text,
  pet_name text,
  species text,
  breed text,
  microchip text,
  vetconnect_id text,
  owner_name text,
  owner_phone text,
  veterinarian_name text,
  practice_name text,
  manufacturer text,
  batch_number text,
  vaccine_name text,
  province text,
  district text,
  qr_payload text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dvs_certificates_status_idx on public.dvs_certificates (status);
create index if not exists dvs_certificates_pet_idx on public.dvs_certificates (pet_id);
create index if not exists dvs_certificates_owner_idx on public.dvs_certificates (owner_account_id);
create index if not exists dvs_certificates_expires_idx on public.dvs_certificates (expires_at);
create index if not exists dvs_certificates_code_idx on public.dvs_certificates (verification_code);

create table if not exists public.dvs_qr_scans (
  id text primary key,
  certificate_id text references public.dvs_certificates(id) on delete set null,
  verification_code text,
  result text not null check (result in ('valid', 'expired', 'cancelled', 'amended', 'suspicious', 'not_found', 'invalid')),
  scanner_context text,
  location_label text,
  scanned_at timestamptz not null default now()
);

create index if not exists dvs_qr_scans_scanned_idx on public.dvs_qr_scans (scanned_at desc);
create index if not exists dvs_qr_scans_cert_idx on public.dvs_qr_scans (certificate_id);

create table if not exists public.dvs_rabies_cases (
  id text primary key,
  status text not null default 'suspected' check (status in ('suspected', 'confirmed', 'negative')),
  species text,
  pet_id uuid references public.pets(id) on delete set null,
  pet_name text,
  province text,
  district text,
  location_label text,
  latitude double precision,
  longitude double precision,
  vaccination_status text,
  reported_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dvs_rabies_cases_status_idx on public.dvs_rabies_cases (status);
create index if not exists dvs_rabies_cases_reported_idx on public.dvs_rabies_cases (reported_at desc);

create table if not exists public.dvs_audit_log (
  id text primary key,
  actor_type text not null default 'dvs',
  actor_id text,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dvs_audit_log_created_idx on public.dvs_audit_log (created_at desc);
create index if not exists dvs_audit_log_entity_idx on public.dvs_audit_log (entity_type, entity_id);

create table if not exists public.dvs_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.dvs_settings (key, value)
values
  ('certificate_validity_days', '365'::jsonb),
  ('coverage_alert_threshold', '70'::jsonb),
  ('expiry_warning_days', '30'::jsonb),
  ('verification_enabled', 'true'::jsonb)
on conflict (key) do nothing;

alter table public.dvs_accounts enable row level security;
alter table public.dvs_vaccine_batches enable row level security;
alter table public.dvs_vaccinations enable row level security;
alter table public.dvs_certificates enable row level security;
alter table public.dvs_qr_scans enable row level security;
alter table public.dvs_rabies_cases enable row level security;
alter table public.dvs_audit_log enable row level security;
alter table public.dvs_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_accounts' and policyname = 'dvs_accounts_all') then
    create policy dvs_accounts_all on public.dvs_accounts for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_vaccine_batches' and policyname = 'dvs_vaccine_batches_all') then
    create policy dvs_vaccine_batches_all on public.dvs_vaccine_batches for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_vaccinations' and policyname = 'dvs_vaccinations_all') then
    create policy dvs_vaccinations_all on public.dvs_vaccinations for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_certificates' and policyname = 'dvs_certificates_all') then
    create policy dvs_certificates_all on public.dvs_certificates for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_qr_scans' and policyname = 'dvs_qr_scans_all') then
    create policy dvs_qr_scans_all on public.dvs_qr_scans for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_rabies_cases' and policyname = 'dvs_rabies_cases_all') then
    create policy dvs_rabies_cases_all on public.dvs_rabies_cases for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_audit_log' and policyname = 'dvs_audit_log_all') then
    create policy dvs_audit_log_all on public.dvs_audit_log for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_settings' and policyname = 'dvs_settings_all') then
    create policy dvs_settings_all on public.dvs_settings for all using (true) with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
