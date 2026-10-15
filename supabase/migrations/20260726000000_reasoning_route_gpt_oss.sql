-- The reasoning class routed to Qwen3 235B *thinking*, which takes 3+ minutes per answer and dies
-- inside the edge-function wall clock. Route reasoning to GPT-OSS 120B (about 20 s, good JSON), with the
-- non-thinking Qwen3 235B and DeepSeek V3.1 as fallbacks, and retire the thinking model from routing.
insert into ai_models (name, model_id, provider_id, description, best_for, context_window, max_output, cost_per_1k_input, cost_per_1k_output, is_enabled, is_default, is_open_source, strip_reasoning, supports_json, supports_vision, supports_images_out, sort_order)
select 'Qwen3 235B (instruct)', 'qwen/qwen3-235b-a22b-2507', '5d1ae15f-838b-4e5d-bf20-708fccc381e2', 'Same model without the long thinking pass; answers in seconds.', array['reasoning','writing'], 131072, 32768, 0.000090, 0.000550, true, false, true, false, true, false, false, 121
where not exists (select 1 from ai_models where model_id = 'qwen/qwen3-235b-a22b-2507' and provider_id = '5d1ae15f-838b-4e5d-bf20-708fccc381e2');
insert into model_rates (provider_slug, model_id, display_name, input_per_1m, output_per_1m, is_active, source)
select 'openrouter', 'qwen/qwen3-235b-a22b-2507', 'Qwen3 235B (instruct)', 0.0900, 0.5500, true, 'openrouter'
where not exists (select 1 from model_rates where provider_slug='openrouter' and model_id='qwen/qwen3-235b-a22b-2507');
update ai_routing_rules set
  model_id = '520befda-cc80-4557-9af6-397ba972b896',
  fallback_model_ids = array[(select id from ai_models where model_id='qwen/qwen3-235b-a22b-2507' and provider_id='5d1ae15f-838b-4e5d-bf20-708fccc381e2'), '8d4bc732-ed40-469b-987e-5ee2da887009']::uuid[],
  updated_at = now()
where id = 'ecf5dd3f-60a8-462d-ae12-e638a901e4a9';
update ai_models set is_enabled = false, description = 'Strong but slow: 3+ minutes per answer, longer than an edge function may run. Kept for reference.' where id = '4b5a866b-9ef4-4824-a5d8-ab1985062423';
