-- Chat message media (image / video / audio)

alter table public.messages
  add column if not exists media_url text;

alter table public.messages
  add column if not exists media_type text not null default 'none';

do $$ begin
  alter table public.messages
    drop constraint if exists messages_media_type_check;
  alter table public.messages
    add constraint messages_media_type_check
    check (media_type in ('none', 'image', 'video', 'audio'));
exception
  when others then null;
end $$;

-- Allow caption-only or media-only messages
alter table public.messages alter column body set default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  41943040,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/aac'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat media public read" on storage.objects;
create policy "chat media public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'chat-media');

drop policy if exists "chat media upload" on storage.objects;
create policy "chat media upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'chat-media');

drop policy if exists "chat media update" on storage.objects;
create policy "chat media update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'chat-media')
  with check (bucket_id = 'chat-media');

drop policy if exists "chat media delete" on storage.objects;
create policy "chat media delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'chat-media');

notify pgrst, 'reload schema';
