-- Branches and failure in plain words. A board can decide before it works
-- (a "branch" step, Kinika classifying what arrived), and says what to do
-- when a step fails (policy.on_failure: skip | ask | stop; ask pauses the run
-- so the founder can try again, skip the step, or stop).

ALTER TABLE public.automation_run_steps DROP CONSTRAINT IF EXISTS automation_run_steps_type_check;
ALTER TABLE public.automation_run_steps ADD CONSTRAINT automation_run_steps_type_check
  CHECK (type IN ('agent_task', 'approval', 'native', 'connector', 'branch'));

-- The classifier's prompt.
insert into ai_system_prompts (task_type, name, description, system_prompt, is_active, version)
select v.task_type, v.name, v.description, v.system_prompt, true, 1
from (values
('run_branch', 'Board branch: which way?', 'Kinika decides which branch of a board applies to what arrived.', 'You are Kinika deciding which way a board goes. You are given a question the founder wrote, the options they named, and what arrived (an email, a message, an order, a comment, or the task brief). Pick exactly one option. The last option is the "otherwise" and is the right answer whenever none of the others clearly applies. Never invent an option.

Return ONLY a JSON object: { "choice": "<the option label, exactly as written>", "reason": "<one short sentence in plain words>" }')
) as v(task_type, name, description, system_prompt)
on conflict (task_type) do update
  set name = excluded.name, description = excluded.description,
      system_prompt = coalesce(nullif(ai_system_prompts.system_prompt, ''), excluded.system_prompt), is_active = true;

-- The planners learn branches and the failure choice. Appended once; admin edits kept.
UPDATE public.ai_system_prompts
SET system_prompt = system_prompt || E'\n\nBRANCHES (optional)\n- When the task reads differently depending on what arrives ("if it is a complaint… otherwise…"), set "branches": { "question": "<what Kinika checks, in the founder''s words>", "options": [ { "label": "it is a complaint", "action": "run", "brief": "<what the agent does in this case>" }, { "label": "otherwise", "action": "ask" } ] }. Actions: "run" (the agent does it with that brief), "ask" (Kinika asks the founder first), "skip" (nothing happens). Two to four options; the last is the otherwise. Omit "branches" when the task reads one way.\n- "on_failure": what to do when a step fails: "ask" (pause and ask the founder; the default), "skip" (skip that step and carry on), or "stop".'
WHERE task_type IN ('plan_board', 'automation_planner') AND position('BRANCHES (optional)' IN system_prompt) = 0;
