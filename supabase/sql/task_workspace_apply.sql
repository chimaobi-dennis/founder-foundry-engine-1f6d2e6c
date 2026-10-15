-- A founder task worked with Kinika in the workspace: deliverables on the task,
-- one Kinika conversation per task, and two task types for the gateway.
alter table plan_tasks add column if not exists deliverables jsonb not null default '[]'::jsonb;

alter table mentor_conversations add column if not exists plan_task_id uuid references plan_tasks(id) on delete cascade;
alter table mentor_conversations drop constraint if exists mentor_conversations_brand_id_key;
create unique index if not exists mentor_conversations_brand_general on mentor_conversations(brand_id) where plan_task_id is null;
create unique index if not exists mentor_conversations_task on mentor_conversations(plan_task_id) where plan_task_id is not null;

insert into ai_task_types (task_type, class_slug, description, is_system)
values ('task_breakdown', 'fast', 'Breaks a founder task on the plan into the deliverables that complete it.', true),
       ('task_chat', 'writing', 'Kinika working a plan task with the founder in the workspace.', true)
on conflict (task_type) do nothing;
