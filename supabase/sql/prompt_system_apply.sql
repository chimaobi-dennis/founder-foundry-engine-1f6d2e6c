-- One prompt system: every prompt Kinika or an agent uses is a key in the registry, with a code
-- default; admins override the base text, add instructions, and attach training examples.
alter table ai_system_prompts drop constraint if exists ai_system_prompts_task_type_check;
alter table ai_system_prompts
  add column if not exists instructions text,
  add column if not exists examples jsonb not null default '[]'::jsonb,
  add column if not exists model_notes text;
alter table ai_prompt_versions
  add column if not exists instructions text,
  add column if not exists examples jsonb;
