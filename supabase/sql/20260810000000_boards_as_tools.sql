-- Standing tasks as tools. Every active board on Kinika's team can be
-- called: Kinika starts one from a conversation (a RUN_BOARD block in its
-- reply), and a board can hand its result to another board (a "tool" step
-- after the founder's approval; the calling run waits for the result).

ALTER TABLE public.automation_run_steps DROP CONSTRAINT IF EXISTS automation_run_steps_type_check;
ALTER TABLE public.automation_run_steps ADD CONSTRAINT automation_run_steps_type_check
  CHECK (type IN ('agent_task', 'approval', 'native', 'connector', 'branch', 'tool'));

-- How Kinika sees the boards and starts one. Appended to the task conversation and the Kinika page.
insert into ai_system_prompts (task_type, name, description, system_prompt, is_active, version)
select v.task_type, v.name, v.description, v.system_prompt, true, 1
from (values
('kinika_boards', 'Kinika: the boards as tools', 'The standing boards on the team, and the RUN_BOARD block Kinika appends to start one from a conversation.', 'THE BOARDS ON KINIKA''S TEAM (standing work already set up; each is a tool you may start):
{{boards}}
When the founder asks for work one of these boards does, or it is plainly the next step of the task, start it instead of doing the work yourself: append, after your prose, one block per board:
<RUN_BOARD id="<board id exactly as listed>" d="D2">what the board should work on this time, in full, with everything it needs from this conversation</RUN_BOARD>
The d attribute names the deliverable the result belongs to (D1, D2…) and may be left out. At most two boards per reply. Start a board only when its brief is complete; if something is missing, ask the founder first and start nothing. Tell the founder in one short sentence that the board has started and that they will approve its result. Never write the block when no listed board fits, and never invent a board id.')
) as v(task_type, name, description, system_prompt)
on conflict (task_type) do update
  set name = excluded.name, description = excluded.description,
      system_prompt = coalesce(nullif(ai_system_prompts.system_prompt, ''), excluded.system_prompt), is_active = true;

-- The planners learn the hand-off. Appended once; admin edits kept.
UPDATE public.ai_system_prompts
SET system_prompt = system_prompt || E'\n\nBOARDS ON THE TEAM (standing work a result can be handed to)\n{{boards}}\n- "then": when the result of this task should go on to one of those boards (research the newsletter board turns into an issue, a report the social board posts from), set "then": { "board_id": "<id exactly as listed>" }. The result is handed over after the founder approves it, and this board waits for the other one to finish. Omit "then" otherwise; never a board that is not listed.'
WHERE task_type IN ('plan_board', 'automation_planner') AND position('BOARDS ON THE TEAM' IN system_prompt) = 0;
