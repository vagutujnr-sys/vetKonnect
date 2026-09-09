-- Chat reply metadata + notification actor avatars

alter table public.messages
  add column if not exists reply_to_id text;

alter table public.messages
  add column if not exists reply_preview text;

alter table public.messages
  add column if not exists reply_sender_name text;

alter table public.notifications
  add column if not exists image_url text;

notify pgrst, 'reload schema';
