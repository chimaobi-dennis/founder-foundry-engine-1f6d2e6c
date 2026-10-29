-- A document or list the founder finalises or approves is complete: say so on the state line.
UPDATE public.ai_system_prompts
SET system_prompt = system_prompt || E'\nWHAT COUNTS AS COMPLETE: a decision deliverable is complete when the founder has chosen. A document or list deliverable is complete in the reply where the founder approves it or asks you to finalise it (words like "finalize", "finalise", "approve", "looks good", "that is it", "done") and you have written its final version; it is also complete when you write it in full in reply to such a request. Put it in "closed" in that same reply with outcome "Document: <title>" or the list itself. Whenever your reply says something is finalised, final, approved, complete or done, that deliverable must be in "closed"; never say it in words and leave it open.',
    updated_at = now()
WHERE task_type = 'task_chat_contract' AND position('WHAT COUNTS AS COMPLETE' IN system_prompt) = 0;
