-- Profile photos for app accounts

alter table public.accounts
  add column if not exists avatar_url text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public profile photos read" on storage.objects;
create policy "public profile photos read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'profile-photos');

drop policy if exists "public profile photos upload" on storage.objects;
create policy "public profile photos upload"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'profile-photos');

drop policy if exists "public profile photos update" on storage.objects;
create policy "public profile photos update"
  on storage.objects for update to anon, authenticated
  using (bucket_id = 'profile-photos')
  with check (bucket_id = 'profile-photos');

drop policy if exists "public profile photos delete" on storage.objects;
create policy "public profile photos delete"
  on storage.objects for delete to anon, authenticated
  using (bucket_id = 'profile-photos');

notify pgrst, 'reload schema';
