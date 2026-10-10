-- Kinika · Understanding first (S2) — paste into Supabase → SQL Editor → Run.
-- Safe to run more than once. Then: supabase functions deploy understanding founder-plan run-step

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Understanding first (build plan S2)
--
-- A brand is "understood" when the founder has approved Kinika's read-back of
-- the business. Until then nothing else in Kinika is offered. The read-back
-- writes brand_dna (with where each line came from and how sure Kinika is),
-- the journey stage, the kind of business and the founder's goal, which the
-- plan builder reads.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS understanding_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS business_kind text
    CONSTRAINT brands_business_kind_check CHECK (business_kind IS NULL OR business_kind IN ('starting', 'running', 'creator', 'other')),
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS goal_horizon text;

-- Per-field provenance for the read-back: {"brand_voice": {"source": "site", "confidence": "sure"}, …}
ALTER TABLE public.brand_dna
  ADD COLUMN IF NOT EXISTS field_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Routing: the read-back is its own task type so an admin can route it.
INSERT INTO public.ai_task_types (task_type, class_slug, description, is_system) VALUES
  ('understanding', 'fast', 'Reads what a founder said, their site and documents, and writes back the business as Kinika understands it.', true)
ON CONFLICT (task_type) DO NOTHING;

COMMIT;
