-- The state line and the document block: the tags are literal, and one document per reply.
-- Kinika sometimes wrote "STATE {…}" without its tags and two <DOCUMENT> blocks in one reply;
-- the parser now reads both, and the contract says it plainly.
UPDATE public.ai_system_prompts
SET system_prompt = system_prompt || E'\nWrite the tags literally: the line starts with <STATE> and ends with </STATE>; never a bare STATE. Write at most one <DOCUMENT title="…">…</DOCUMENT> block per reply; when two deliverables are documents, write the second in a later reply after the founder has seen the first.',
    updated_at = now()
WHERE task_type = 'task_chat_contract' AND position('never a bare STATE' IN system_prompt) = 0;
