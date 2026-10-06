-- Patch for template_variants:
-- 1. Drop visual_html (scene_json only)
-- 2. Add missing operational columns: render_engine, is_primary, fitness_check_passed
-- 3. Add creator insert/update policies

-- Drop visual_html — scene_json only
ALTER TABLE public.template_variants DROP COLUMN IF EXISTS visual_html;

-- Add columns that the service layer expects
ALTER TABLE public.template_variants
  ADD COLUMN IF NOT EXISTS render_engine       text NOT NULL DEFAULT 'scene',
  ADD COLUMN IF NOT EXISTS is_primary          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fitness_check_passed boolean NOT NULL DEFAULT false;

-- Creator insert policy
CREATE POLICY "Creators can insert variants for own templates"
  ON public.template_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prostudio_templates t
      WHERE t.id = template_id
        AND t.creator_id = auth.uid()
    )
  );

-- Creator update policy
CREATE POLICY "Creators can update variants for own templates"
  ON public.template_variants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prostudio_templates t
      WHERE t.id = template_id
        AND t.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prostudio_templates t
      WHERE t.id = template_id
        AND t.creator_id = auth.uid()
    )
  );