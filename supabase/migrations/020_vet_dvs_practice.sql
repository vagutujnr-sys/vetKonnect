-- Recognised rabies vaccines, vet-entered batches, practice notes, and reports that feed DVS.

create table if not exists public.dvs_recognised_vaccines (
  id text primary key,
  name text not null,
  vaccine_type text not null,
  manufacturer text not null,
  species text not null default 'Dogs, cats',
  strain text,
  registration_number text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dvs_recognised_vaccines_active_idx on public.dvs_recognised_vaccines (active);

alter table public.dvs_vaccine_batches add column if not exists vaccine_id text references public.dvs_recognised_vaccines(id) on delete set null;
alter table public.dvs_vaccine_batches add column if not exists veterinarian_account_id text;
alter table public.dvs_vaccine_batches add column if not exists source text not null default 'dvs';

alter table public.dvs_vaccinations add column if not exists vaccine_id text references public.dvs_recognised_vaccines(id) on delete set null;
alter table public.dvs_certificates add column if not exists vaccine_id text references public.dvs_recognised_vaccines(id) on delete set null;

alter table public.dvs_rabies_cases add column if not exists veterinarian_account_id text;
alter table public.dvs_rabies_cases add column if not exists source text not null default 'dvs';

create table if not exists public.vet_practice_notes (
  id text primary key,
  veterinarian_account_id text not null,
  pet_id uuid references public.pets(id) on delete set null,
  pet_name text,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vet_practice_notes_vet_idx on public.vet_practice_notes (veterinarian_account_id, created_at desc);

create table if not exists public.dvs_vet_case_reports (
  id text primary key,
  veterinarian_account_id text not null,
  veterinarian_name text,
  practice_name text,
  pet_id uuid references public.pets(id) on delete set null,
  pet_name text,
  species text,
  case_status text not null default 'suspected' check (case_status in ('suspected', 'confirmed', 'negative')),
  province text,
  district text,
  location_label text,
  latitude double precision,
  longitude double precision,
  vaccination_status text,
  notes text,
  rabies_case_id text references public.dvs_rabies_cases(id) on delete set null,
  review_status text not null default 'submitted' check (review_status in ('submitted', 'acknowledged', 'under_review')),
  dvs_notes text,
  reported_at timestamptz not null default now()
);

create index if not exists dvs_vet_case_reports_status_idx on public.dvs_vet_case_reports (review_status, reported_at desc);
create index if not exists dvs_vet_case_reports_vet_idx on public.dvs_vet_case_reports (veterinarian_account_id, reported_at desc);

create table if not exists public.dvs_animal_health_reports (
  id text primary key,
  veterinarian_account_id text not null,
  veterinarian_name text,
  practice_name text,
  report_type text not null default 'other' check (report_type in (
    'monthly_summary',
    'outbreak',
    'notifiable_disease',
    'vaccination_campaign',
    'laboratory',
    'other'
  )),
  title text not null,
  body text not null,
  province text,
  district text,
  pet_id uuid references public.pets(id) on delete set null,
  review_status text not null default 'submitted' check (review_status in ('submitted', 'acknowledged', 'actioned')),
  dvs_notes text,
  submitted_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists dvs_animal_health_reports_status_idx on public.dvs_animal_health_reports (review_status, submitted_at desc);
create index if not exists dvs_animal_health_reports_vet_idx on public.dvs_animal_health_reports (veterinarian_account_id, submitted_at desc);

insert into public.dvs_recognised_vaccines
  (id, name, vaccine_type, manufacturer, species, strain, registration_number, notes)
values
  ('vac-nobivac-rabies', 'Nobivac Rabies', 'Inactivated injectable', 'MSD Animal Health', 'Dogs, cats', 'Pasteur RIV', 'DVS-RV-001', 'Inactivated adjuvanted rabies vaccine widely used in Zimbabwe companion-animal practice.'),
  ('vac-rabisin', 'Rabisin', 'Inactivated injectable', 'Boehringer Ingelheim', 'Dogs, cats', 'Pasteur', 'DVS-RV-002', 'Inactivated rabies vaccine for parenteral use in dogs and cats.'),
  ('vac-defensor-3', 'Defensor 3', 'Inactivated injectable', 'Zoetis', 'Dogs, cats', 'Pasteur', 'DVS-RV-003', 'Three-year duration inactivated rabies vaccine where labelled.'),
  ('vac-obp-rabies', 'OBP Rabies Vaccine', 'Inactivated injectable', 'Onderstepoort Biological Products', 'Dogs, cats, livestock', 'Flury LEP', 'DVS-RV-004', 'Southern African registered inactivated rabies vaccine; used in dogs, cats and selected livestock.'),
  ('vac-canigen-rabies', 'Canigen Rabies', 'Inactivated injectable', 'Virbac', 'Dogs, cats', 'Pasteur', 'DVS-RV-005', 'Inactivated parenteral rabies vaccine for dogs and cats.'),
  ('vac-rabigen-mono', 'Rabigen Mono', 'Inactivated injectable', 'Virbac', 'Dogs, cats', 'Pasteur', 'DVS-RV-006', 'Monovalent inactivated rabies vaccine for companion animals.'),
  ('vac-imrab-3', 'Imrab 3', 'Inactivated injectable', 'Boehringer Ingelheim', 'Dogs, cats', 'Pasteur', 'DVS-RV-007', 'Inactivated rabies vaccine used in companion-animal immunisation programmes.'),
  ('vac-raksharab', 'Raksharab', 'Inactivated injectable', 'Indian Immunologicals', 'Dogs', 'Pasteur', 'DVS-RV-008', 'Inactivated canine rabies vaccine used in mass dog vaccination campaigns.'),
  ('vac-rabivac', 'Rabivac', 'Inactivated injectable', 'Bioveta', 'Dogs, cats', 'Pasteur', 'DVS-RV-009', 'Inactivated parenteral rabies vaccine for dogs and cats.'),
  ('vac-rabigen-sag2', 'Rabigen SAG2', 'Live oral', 'Virbac', 'Wildlife (foxes, jackals)', 'SAG2', 'DVS-RV-010', 'Live attenuated oral rabies vaccine for wildlife baits — not for routine pet certificates.')
on conflict (id) do nothing;

alter table public.dvs_recognised_vaccines enable row level security;
alter table public.vet_practice_notes enable row level security;
alter table public.dvs_vet_case_reports enable row level security;
alter table public.dvs_animal_health_reports enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_recognised_vaccines' and policyname = 'dvs_recognised_vaccines_all') then
    create policy dvs_recognised_vaccines_all on public.dvs_recognised_vaccines for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vet_practice_notes' and policyname = 'vet_practice_notes_all') then
    create policy vet_practice_notes_all on public.vet_practice_notes for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_vet_case_reports' and policyname = 'dvs_vet_case_reports_all') then
    create policy dvs_vet_case_reports_all on public.dvs_vet_case_reports for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'dvs_animal_health_reports' and policyname = 'dvs_animal_health_reports_all') then
    create policy dvs_animal_health_reports_all on public.dvs_animal_health_reports for all using (true) with check (true);
  end if;
end
$$;
