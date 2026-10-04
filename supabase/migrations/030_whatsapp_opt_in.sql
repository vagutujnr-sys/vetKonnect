-- Owner consent before Twilio can send visit receipts and follow-up visits.

alter table public.accounts
  add column if not exists whatsapp_opt_in boolean not null default false;

notify pgrst, 'reload schema';
