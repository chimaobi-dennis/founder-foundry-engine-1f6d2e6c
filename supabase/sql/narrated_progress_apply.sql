-- Narrated progress for task chat: the real steps of Kinika's reply, written
-- onto the conversation as they happen; the browser polls them while pending.
alter table public.mentor_conversations add column if not exists progress jsonb not null default '[]'::jsonb;
comment on column public.mentor_conversations.progress is 'Steps of the reply in flight: [{key,label,status,at,note}]. Reset to [] at the start of each turn.';
