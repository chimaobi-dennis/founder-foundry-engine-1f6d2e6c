-- Kinika's task replies are produced server-side so a page reload cannot stop them.
alter table mentor_conversations
  add column if not exists pending_since timestamptz,
  add column if not exists last_error text,
  add column if not exists last_followups jsonb;
