-- Social audit from connections: Kinika reads the founder's accounts instead of asking for the numbers.
insert into ai_system_prompts (task_type, name, description, system_prompt, is_active, version)
select v.task_type, v.name, v.description, v.system_prompt, true, 1
from (values
  ('task_chat_social_read', 'Task conversation: accounts read', 'Sent after Kinika has read the founder''s social accounts through their connections; the facts with their source.',
   E'Kinika has read the founder''s own accounts through their connections. These are the facts:\n{{accounts}}\nUse them now for the open deliverables that need them: write the audit, the comparison or the decision with these numbers, and cite each number''s platform and read date in the text ("400 followers on Instagram, read 30 October 2026"). Numbers read this way are facts, never "Your decision" lines; what the founder must still choose (which platform to focus on, a cadence) stays a decision and you ask for it. Do not ask for any number you now have. If an account could not be read, say so in one line and carry on with the rest.')
) as v(task_type, name, description, system_prompt)
on conflict (task_type) do update
  set system_prompt = coalesce(nullif(ai_system_prompts.system_prompt, ''), excluded.system_prompt),
      name = excluded.name, description = excluded.description, updated_at = now();

update public.ai_system_prompts
set system_prompt = system_prompt || E'\nFACTS ABOUT THE FOUNDER''S OWN ACCOUNTS: when a deliverable needs follower counts, post counts, engagement or which platform performs best, never ask the founder to type them. Say in one sentence that Kinika can read the accounts once they are connected, put "connect":"social" on the state line, and go on with what does not depend on those numbers. A number read from a connection is cited with its platform and read date and is never a "Your decision" line; a number the founder chooses (a target, a cadence) still is.',
    updated_at = now()
where task_type = 'task_chat_rules' and position('FACTS ABOUT THE FOUNDER' in system_prompt) = 0;

update public.ai_system_prompts
set system_prompt = system_prompt || E'\n"connect" is present, with the value "social", only when the next step needs facts from the founder''s own social accounts that you do not have; the workspace then offers the founder to connect and lets Kinika read them. Omit it otherwise.',
    updated_at = now()
where task_type = 'task_chat_contract' and position('"connect" is present' in system_prompt) = 0;
