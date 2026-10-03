-- Council registration proof can wait for approval, and certificates may be photos or PDFs.

alter table public.dvs_animal_licences drop constraint if exists dvs_animal_licences_status_check;

alter table public.dvs_animal_licences
  add constraint dvs_animal_licences_status_check
  check (status in ('active', 'expired', 'revoked', 'pending'));

alter table public.dvs_animal_licences add column if not exists proof_url text;

update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf']
where id = 'pet-photos';
