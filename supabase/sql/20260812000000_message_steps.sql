-- The steps Kinika took for a reply stay on the reply, for the record.
alter table public.mentor_messages add column if not exists steps jsonb;
