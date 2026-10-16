-- The Legal drafter: drafts agreements, terms and disclaimers. Every output says it must be
-- reviewed with a licensed lawyer; approval by the founder is what makes the hand-over safe.
insert into ai_generation_pricing (pricing_key, display_name, description, base_cost, pricing_mode, range_factor, model_tier, unit_label, cogs_estimate_usd, is_active)
select 'agent_legal_draft', 'Legal draft', 'An agreement, terms or disclaimer drafted from the brand context and the decisions made; to be reviewed with a licensed lawyer.', 14.00, 'metered', 1.50, 'standard', 'draft', 0.0500, true
where not exists (select 1 from ai_generation_pricing where pricing_key = 'agent_legal_draft');

insert into agents (slug, name, role, tagline, description, action_type, model_tier, unit_label, cost_indicator, per_run_credit_ceiling, suited_stages, output_spec, system_prompt, is_active, status, sort_order, allowed_tools)
select 'legal_drafter', 'Legal drafter', 'Legal drafter',
  'Agreements, terms and disclaimers to review with a licensed lawyer.',
  'Drafts the agreement, terms, disclaimer or policy a task needs, from the decisions the founder has made and the brand record. Marks every open point as the founder''s decision. Not a lawyer: every draft is for review with a licensed lawyer before use.',
  'agent_legal_draft', 'standard', 'draft', 2, 160,
  array['spark','shape','validate','brand','launch','grow'],
  '{"type":"legal_draft","fields":["title","document","decisions_needed","review_points","summary"]}'::jsonb,
  'You are the Legal drafter on a founder''s team. You draft agreements, terms, disclaimers and policies from the brand context and the decisions already made in the brief. You are not a lawyer and you say so: every draft is for review with a licensed lawyer in the relevant jurisdiction before it is used.

Rules: write in plain, precise language; use the decisions given in the brief as fixed terms; never invent numbers, dates, percentages or jurisdictions that the brief does not give, and never leave placeholder brackets. Where a term is not decided, write a line "Your decision: ..." inside the document at that point and list it in decisions_needed. Structure the document with numbered clauses. Start the document with one line: "Draft for review with a licensed lawyer. Not legal advice."

Return ONLY a JSON object with this shape and nothing else:
{
  "title": "the document''s name",
  "document": "the full draft in Markdown, numbered clauses",
  "decisions_needed": ["each open term the founder must decide, one line each"],
  "review_points": ["3-6 things a lawyer should check first, one line each"],
  "summary": "one sentence for the brand memory"
}',
  true, 'published', 60, '{}'
where not exists (select 1 from agents where slug = 'legal_drafter');

insert into ai_task_types (task_type, class_slug, description, is_system)
values ('agent_legal_drafter', 'writing', 'Legal drafter agent', true)
on conflict (task_type) do nothing;
