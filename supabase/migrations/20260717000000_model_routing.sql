-- ─────────────────────────────────────────────────────────────────────────────
-- Model routing — switch models per kind of work, from Admin, at any time
--
-- Every AI call names a task type (mentor_chat, agent_copywriter, …). Task
-- types belong to a CLASS of work (fast, writing, reasoning, coding, vision).
-- A ROUTING PROFILE maps every class to a primary model and ordered fallbacks.
-- Exactly one profile is active; switching profiles moves every call at once
-- (open-source models in development, proprietary ones in production). A
-- task type can also be pinned to a model inside a profile.
--
-- Resolution, in resolve_ai_route(): the caller's own preference (existing)
-- → task pin in the active profile → the task's class rule → the tier's class
-- rule → the legacy ai_task_defaults row → system_ai. The gateway tries the
-- candidates in order and retries on rate limits and provider outages.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Model capabilities the router and the gateway need ──────────────────────
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS max_output integer;
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS supports_json boolean NOT NULL DEFAULT true;
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS strip_reasoning boolean NOT NULL DEFAULT false;  -- R1-style <think> blocks
ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS is_open_source boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS ai_models_provider_model_unique ON public.ai_models (provider_id, model_id);

-- ── Classes of work ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_task_classes (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0
);
INSERT INTO public.ai_task_classes (slug, name, description, sort_order) VALUES
  ('fast',      'Fast',      'Classify, summarize, route, plan drafts, self-review. Cheap and quick.', 10),
  ('writing',   'Writing',   'Copy, briefs, documents, Mentor conversation. The everyday model.', 20),
  ('reasoning', 'Reasoning', 'Long, careful work: plans, research, anything irreversible.', 30),
  ('coding',    'Coding',    'Reading and changing code (the Developer agent).', 40),
  ('vision',    'Vision',    'Tasks that look at images (logos, visual review).', 50)
ON CONFLICT (slug) DO NOTHING;

-- ── Task types, each in a class ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_task_types (
  task_type   text PRIMARY KEY,
  class_slug  text REFERENCES public.ai_task_classes(slug) ON DELETE SET NULL,
  description text,
  is_system   boolean NOT NULL DEFAULT false,   -- seeded, not auto-registered
  last_seen_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ai_task_types (task_type, class_slug, description, is_system) VALUES
  ('tier_fast',           'fast',      'Agents asking for the fast tier', true),
  ('tier_standard',       'writing',   'Agents asking for the standard tier', true),
  ('tier_reasoning',      'reasoning', 'Agents asking for the reasoning tier', true),
  ('system_ai',           'writing',   'Last resort when nothing else is configured', true),
  ('mentor_chat',         'writing',   'Mentor conversation', true),
  ('plan_automation',     'fast',      'Describe-it planner', true),
  ('template_generation', 'writing',   'ProStudio templates', true),
  ('document_generation', 'writing',   'DocStudio', true),
  ('campaign_copy',       'writing',   'CampaignKit', true),
  ('reel_script',         'writing',   'ReelBuilder', true),
  ('logo_generation',     'vision',    'LogoStudio', true),
  ('logo_mutation',       'vision',    'LogoStudio variations', true),
  ('image_generation',    'vision',    'Image prompts', true),
  ('agent_copywriter',    'writing',   'Copywriter agent', true),
  ('agent_designer',      'writing',   'Designer agent', true),
  ('agent_researcher',    'reasoning', 'Researcher agent', true),
  ('agent_seo_specialist','writing',   'SEO Specialist agent', true),
  ('agent_developer',     'coding',    'Developer agent', true)
ON CONFLICT (task_type) DO NOTHING;

-- The gateway registers task types it has not seen, in the class of the tier
-- they asked for (or writing), so admins always see the full list.
CREATE OR REPLACE FUNCTION public.register_ai_task_type(p_task_type text, p_tier text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.ai_task_types (task_type, class_slug, description, last_seen_at)
  VALUES (p_task_type,
          CASE p_tier WHEN 'fast' THEN 'fast' WHEN 'reasoning' THEN 'reasoning' WHEN 'coding' THEN 'coding' ELSE 'writing' END,
          'Registered automatically on first use', now())
  ON CONFLICT (task_type) DO UPDATE SET last_seen_at = now();
$$;
REVOKE ALL ON FUNCTION public.register_ai_task_type(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_ai_task_type(text, text) TO service_role;

-- ── Profiles and rules ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_routing_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_routing_profiles_one_active ON public.ai_routing_profiles ((true)) WHERE is_active;

CREATE TABLE IF NOT EXISTS public.ai_routing_rules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         uuid NOT NULL REFERENCES public.ai_routing_profiles(id) ON DELETE CASCADE,
  class_slug         text NOT NULL REFERENCES public.ai_task_classes(slug) ON DELETE CASCADE,
  model_id           uuid NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  fallback_model_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, class_slug)
);

CREATE TABLE IF NOT EXISTS public.ai_task_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES public.ai_routing_profiles(id) ON DELETE CASCADE,
  task_type   text NOT NULL REFERENCES public.ai_task_types(task_type) ON DELETE CASCADE,
  model_id    uuid NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
  UNIQUE (profile_id, task_type)
);

ALTER TABLE public.ai_task_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_routing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_task_overrides ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_task_classes', 'ai_task_types', 'ai_routing_profiles', 'ai_routing_rules', 'ai_task_overrides'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated read %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Authenticated read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Admins manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

-- Switching is one call, and it is atomic: no moment with zero or two active profiles.
CREATE OR REPLACE FUNCTION public.activate_routing_profile(p_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_missing text[];
BEGIN
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'NOT_ALLOWED'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ai_routing_profiles WHERE id = p_profile_id) THEN RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND'); END IF;
  -- Every class must route somewhere usable, or calls in it would fail.
  SELECT array_agg(c.slug ORDER BY c.sort_order) INTO v_missing
  FROM public.ai_task_classes c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ai_routing_rules r
    JOIN public.ai_models m ON m.id = r.model_id AND m.is_enabled
    JOIN public.ai_providers p ON p.id = m.provider_id AND COALESCE(p.is_enabled, true)
    WHERE r.profile_id = p_profile_id AND r.class_slug = c.slug
  );
  IF v_missing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CLASSES_UNROUTED', 'classes', to_jsonb(v_missing));
  END IF;
  UPDATE public.ai_routing_profiles SET is_active = false, updated_at = now() WHERE is_active AND id <> p_profile_id;
  UPDATE public.ai_routing_profiles SET is_active = true, updated_at = now() WHERE id = p_profile_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.activate_routing_profile(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.activate_routing_profile(uuid) TO authenticated;

-- ── The resolver ────────────────────────────────────────────────────────────
-- Returns the ordered candidates for a call. Each candidate carries what the
-- gateway needs; the API key is read separately from ai_provider_secrets.
CREATE OR REPLACE FUNCTION public.resolve_ai_route(p_task_type text, p_tier text DEFAULT NULL, p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile record;
  v_class text;
  v_tier_class text;
  v_ids uuid[] := '{}';
  v_source text := 'none';
  v_tmp uuid;
  v_rule record;
BEGIN
  SELECT * INTO v_profile FROM public.ai_routing_profiles WHERE is_active LIMIT 1;
  v_tier_class := CASE p_tier WHEN 'fast' THEN 'fast' WHEN 'standard' THEN 'writing' WHEN 'reasoning' THEN 'reasoning' WHEN 'coding' THEN 'coding' ELSE NULL END;
  SELECT class_slug INTO v_class FROM public.ai_task_types WHERE task_type = p_task_type;

  -- 1. the caller's own preference (existing feature)
  IF p_user_id IS NOT NULL THEN
    SELECT model_id INTO v_tmp FROM public.user_model_preferences WHERE user_id = p_user_id AND task_type = p_task_type;
    IF v_tmp IS NOT NULL THEN v_ids := array_append(v_ids, v_tmp); v_source := 'user_preference'; END IF;
  END IF;

  IF v_profile.id IS NOT NULL THEN
    -- 2. a pin for this task in the active profile
    SELECT model_id INTO v_tmp FROM public.ai_task_overrides WHERE profile_id = v_profile.id AND task_type = p_task_type;
    IF v_tmp IS NOT NULL THEN v_ids := array_append(v_ids, v_tmp); IF v_source = 'none' THEN v_source := 'task_pin'; END IF; END IF;
    -- 3. the task's class, else the tier's class
    SELECT * INTO v_rule FROM public.ai_routing_rules WHERE profile_id = v_profile.id AND class_slug = COALESCE(v_class, v_tier_class);
    IF v_rule.id IS NOT NULL THEN
      v_ids := v_ids || v_rule.model_id || v_rule.fallback_model_ids;
      IF v_source = 'none' THEN v_source := 'class_rule'; END IF;
      v_class := COALESCE(v_class, v_tier_class);
    END IF;
  END IF;

  -- 4. legacy task defaults, then system_ai
  IF p_tier IS NOT NULL THEN
    SELECT model_id INTO v_tmp FROM public.ai_task_defaults WHERE task_type = 'tier_' || p_tier;
    IF v_tmp IS NOT NULL THEN v_ids := array_append(v_ids, v_tmp); IF v_source = 'none' THEN v_source := 'legacy_tier_default'; END IF; END IF;
  END IF;
  SELECT model_id INTO v_tmp FROM public.ai_task_defaults WHERE task_type = p_task_type;
  IF v_tmp IS NOT NULL THEN v_ids := array_append(v_ids, v_tmp); IF v_source = 'none' THEN v_source := 'legacy_task_default'; END IF; END IF;
  SELECT model_id INTO v_tmp FROM public.ai_task_defaults WHERE task_type = 'system_ai';
  IF v_tmp IS NOT NULL THEN v_ids := array_append(v_ids, v_tmp); IF v_source = 'none' THEN v_source := 'system_ai'; END IF; END IF;

  RETURN jsonb_build_object(
    'profile', v_profile.slug,
    'class', v_class,
    'source', v_source,
    'candidates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'model_row_id', m.id, 'model_id', m.model_id, 'model_name', m.name,
        'max_output', m.max_output, 'strip_reasoning', m.strip_reasoning, 'supports_vision', m.supports_vision,
        'cost_per_1k_input', m.cost_per_1k_input, 'cost_per_1k_output', m.cost_per_1k_output,
        'provider', jsonb_build_object('id', p.id, 'slug', p.slug, 'base_url', p.base_url, 'auth_header_name', p.auth_header_name, 'auth_header_prefix', p.auth_header_prefix, 'is_enabled', COALESCE(p.is_enabled, true))
      ) ORDER BY o.ord)
      FROM (SELECT DISTINCT ON (id) id, ord FROM unnest(v_ids) WITH ORDINALITY AS u(id, ord) ORDER BY id, ord) o
      JOIN public.ai_models m ON m.id = o.id AND m.is_enabled
      JOIN public.ai_providers p ON p.id = m.provider_id AND COALESCE(p.is_enabled, true)
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_ai_route(text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_ai_route(text, text, uuid) TO authenticated, service_role;

-- ── Open-model providers (disabled until a key is added in Admin) ───────────
INSERT INTO public.ai_providers (name, slug, description, base_url, auth_header_name, auth_header_prefix, is_enabled, supports_text, supports_images, supports_streaming) VALUES
  ('OpenRouter', 'openrouter', 'One key for most open and proprietary models. Good for development.', 'https://openrouter.ai/api/v1', 'Authorization', 'Bearer', false, true, true, true),
  ('Groq',       'groq',       'Very fast inference for open models (Llama, GPT-OSS, Qwen).',          'https://api.groq.com/openai/v1', 'Authorization', 'Bearer', false, true, false, true),
  ('Together AI','together',   'Open models at scale (Llama, Qwen, DeepSeek, Kimi).',                   'https://api.together.xyz/v1', 'Authorization', 'Bearer', false, true, true, true),
  ('Fireworks',  'fireworks',  'Open models with fast serving.',                                         'https://api.fireworks.ai/inference/v1', 'Authorization', 'Bearer', false, true, true, true),
  ('DeepInfra',  'deepinfra',  'Low-cost open model hosting.',                                           'https://api.deepinfra.com/v1/openai', 'Authorization', 'Bearer', false, true, true, true),
  ('Cerebras',   'cerebras',   'Fastest tokens per second for a few open models.',                       'https://api.cerebras.ai/v1', 'Authorization', 'Bearer', false, true, false, true)
ON CONFLICT (slug) DO NOTHING;

-- ── Open models to start from (ids and prices are ESTIMATES: verify in Admin) ──
DO $$
DECLARE v_or uuid; v_groq uuid;
BEGIN
  SELECT id INTO v_or FROM public.ai_providers WHERE slug = 'openrouter';
  SELECT id INTO v_groq FROM public.ai_providers WHERE slug = 'groq';
  INSERT INTO public.ai_models (provider_id, name, model_id, description, context_window, max_output, is_enabled, supports_vision, supports_json, strip_reasoning, is_open_source, best_for, cost_per_1k_input, cost_per_1k_output, sort_order) VALUES
    (v_or, 'Llama 3.3 70B',            'meta-llama/llama-3.3-70b-instruct',       'Solid everyday writer; cheap.',                     131072, 16384, true, false, true, false, true, ARRAY['writing','fast'],     0.00010, 0.00030, 100),
    (v_or, 'GPT-OSS 120B',             'openai/gpt-oss-120b',                     'Open-weight reasoning model; good price.',          131072, 32768, true, false, true, true,  true, ARRAY['reasoning','fast'],  0.00010, 0.00050, 110),
    (v_or, 'Qwen3 235B (thinking)',    'qwen/qwen3-235b-a22b-thinking-2507',      'Strong reasoning; emits <think> blocks.',           131072, 32768, true, false, true, true,  true, ARRAY['reasoning'],         0.00020, 0.00080, 120),
    (v_or, 'DeepSeek V3.1',            'deepseek/deepseek-chat-v3.1',             'Strong general model and coder.',                   131072, 32768, true, false, true, true,  true, ARRAY['writing','coding'],  0.00025, 0.00100, 130),
    (v_or, 'Qwen3 Coder',              'qwen/qwen3-coder',                        'Built for code changes.',                           131072, 32768, true, false, true, false, true, ARRAY['coding'],            0.00030, 0.00120, 140),
    (v_or, 'Kimi K2',                  'moonshotai/kimi-k2',                      'Long-context writer and agentic model.',            131072, 32768, true, false, true, false, true, ARRAY['writing','coding'],  0.00050, 0.00200, 150),
    (v_or, 'Llama 4 Maverick (vision)','meta-llama/llama-4-maverick',             'Sees images; open weights.',                        1000000, 16384, true, true,  true, false, true, ARRAY['vision','writing'],  0.00015, 0.00060, 160),
    (v_groq, 'Llama 3.3 70B (Groq)',   'llama-3.3-70b-versatile',                 'Same model, very fast.',                            131072, 32768, true, false, true, false, true, ARRAY['fast','writing'],    0.00059, 0.00079, 200),
    (v_groq, 'GPT-OSS 120B (Groq)',    'openai/gpt-oss-120b',                     'Fast open reasoning.',                              131072, 32768, true, false, true, true,  true, ARRAY['fast','reasoning'],  0.00015, 0.00075, 210),
    (v_groq, 'Qwen3 32B (Groq)',       'qwen/qwen3-32b',                          'Small, quick, capable.',                            131072, 16384, true, false, true, true,  true, ARRAY['fast'],              0.00029, 0.00059, 220)
  ON CONFLICT (provider_id, model_id) DO NOTHING;
END $$;

-- Rates for cost tracking (per 1M; same estimates as above)
INSERT INTO public.model_rates (provider_slug, model_id, display_name, input_per_1m, output_per_1m, is_active, source)
SELECT p.slug, m.model_id, m.name, m.cost_per_1k_input * 1000, m.cost_per_1k_output * 1000, true, 'estimate: verify against the provider price list'
FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id
WHERE p.slug IN ('openrouter', 'groq')
ON CONFLICT (provider_slug, model_id) DO NOTHING;

-- ── Two profiles: what runs today, and an open-source set for development ───
INSERT INTO public.ai_routing_profiles (slug, name, description, is_active) VALUES
  ('production',      'Production',            'Proprietary models: what the app has been using.', true),
  ('open-source-dev', 'Open source (dev)',     'Open models through OpenRouter with Groq fallbacks. Add an OpenRouter key, then activate.', false)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  prod uuid; dev uuid;
  m_flash uuid; m_opus uuid; m_gpt uuid;
  m_llama uuid; m_oss uuid; m_qwen_think uuid; m_ds uuid; m_coder uuid; m_vision uuid; m_gllama uuid; m_goss uuid; m_gqwen uuid;
BEGIN
  SELECT id INTO prod FROM public.ai_routing_profiles WHERE slug = 'production';
  SELECT id INTO dev FROM public.ai_routing_profiles WHERE slug = 'open-source-dev';
  SELECT m.id INTO m_flash FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'google-ai-studio' AND m.model_id = 'gemini-3-flash-preview';
  SELECT m.id INTO m_opus  FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'anthropic' AND m.model_id = 'claude-opus-4-7';
  SELECT m.id INTO m_gpt   FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'openai' AND m.model_id = 'gpt-5.4-mini';
  SELECT m.id INTO m_llama      FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'openrouter' AND m.model_id = 'meta-llama/llama-3.3-70b-instruct';
  SELECT m.id INTO m_oss        FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'openrouter' AND m.model_id = 'openai/gpt-oss-120b';
  SELECT m.id INTO m_qwen_think FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'openrouter' AND m.model_id = 'qwen/qwen3-235b-a22b-thinking-2507';
  SELECT m.id INTO m_ds         FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'openrouter' AND m.model_id = 'deepseek/deepseek-chat-v3.1';
  SELECT m.id INTO m_coder      FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'openrouter' AND m.model_id = 'qwen/qwen3-coder';
  SELECT m.id INTO m_vision     FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'openrouter' AND m.model_id = 'meta-llama/llama-4-maverick';
  SELECT m.id INTO m_gllama     FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'groq' AND m.model_id = 'llama-3.3-70b-versatile';
  SELECT m.id INTO m_goss       FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'groq' AND m.model_id = 'openai/gpt-oss-120b';
  SELECT m.id INTO m_gqwen      FROM public.ai_models m JOIN public.ai_providers p ON p.id = m.provider_id WHERE p.slug = 'groq' AND m.model_id = 'qwen/qwen3-32b';

  -- Production mirrors the current tier defaults, with cheaper fallbacks.
  IF m_flash IS NOT NULL AND m_opus IS NOT NULL THEN
    INSERT INTO public.ai_routing_rules (profile_id, class_slug, model_id, fallback_model_ids) VALUES
      (prod, 'fast',      m_flash, ARRAY_REMOVE(ARRAY[m_gpt], NULL)),
      (prod, 'writing',   m_opus,  ARRAY_REMOVE(ARRAY[m_flash, m_gpt], NULL)),
      (prod, 'reasoning', m_opus,  ARRAY_REMOVE(ARRAY[m_flash], NULL)),
      (prod, 'coding',    m_opus,  ARRAY_REMOVE(ARRAY[m_gpt], NULL)),
      (prod, 'vision',    m_flash, ARRAY_REMOVE(ARRAY[m_opus], NULL))
    ON CONFLICT (profile_id, class_slug) DO NOTHING;
  END IF;

  IF m_llama IS NOT NULL THEN
    INSERT INTO public.ai_routing_rules (profile_id, class_slug, model_id, fallback_model_ids) VALUES
      (dev, 'fast',      m_gqwen,      ARRAY_REMOVE(ARRAY[m_gllama, m_llama], NULL)),
      (dev, 'writing',   m_llama,      ARRAY_REMOVE(ARRAY[m_ds, m_gllama], NULL)),
      (dev, 'reasoning', m_qwen_think, ARRAY_REMOVE(ARRAY[m_oss, m_goss], NULL)),
      (dev, 'coding',    m_coder,      ARRAY_REMOVE(ARRAY[m_ds], NULL)),
      (dev, 'vision',    m_vision,     ARRAY_REMOVE(ARRAY[m_flash], NULL))
    ON CONFLICT (profile_id, class_slug) DO NOTHING;
  END IF;
END $$;
