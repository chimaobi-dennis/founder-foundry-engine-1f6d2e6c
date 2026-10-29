-- Suggested follow-ups: the chip is the theme, the click fills the box with the full request.
UPDATE public.ai_system_prompts
SET system_prompt = replace(system_prompt,
  '"suggestions" are exactly three short replies the founder might give next, in the founder''s own voice, 3 to 9 words each, genuinely different from each other (one can be a question back).',
  '"suggestions" are exactly three things the founder might ask for next, each {"label":"...","value":"..."}: label is the theme in 2 to 5 words (the chip the founder sees, e.g. "Review the report"); value is the full request in the founder''s own voice, one or two sentences the founder could send as written, grounded in what this conversation has established (e.g. "Do a review of the report with the figures we have and tell me what is weak."). The three are genuinely different from each other; one can be a question back.'),
    updated_at = now()
WHERE task_type = 'task_chat_followups' AND position('"label":"..."' IN system_prompt) = 0;
