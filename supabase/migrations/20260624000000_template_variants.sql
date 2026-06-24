-- ─────────────────────────────────────────────────────────────────────────────
-- Template Variant System
--
-- A variant = one prostudio_templates row rendered for one content_platforms row.
-- e.g. "Modern Minimal" × "Instagram Story" is one variant row.
--
-- Admin writes: gated on profiles.role = 'admin' (ownership-based pattern for
-- everything else remains unchanged; this is the first admin-gated table).
-- Platform link: FK to content_platforms.id — dimensions resolved at read time,
-- handles Email's null image_height cleanly.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.template_variants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent template
  template_id         uuid NOT NULL
    REFERENCES public.prostudio_templates(id) ON DELETE CASCADE,

  -- Platform this variant targets — joins to content_platforms for dimensions
  platform_id         uuid NOT NULL
    REFERENCES public.content_platforms(id) ON DELETE RESTRICT,

  -- Each template+platform pair must be unique
  CONSTRAINT template_variants_template_platform_unique
    UNIQUE (template_id, platform_id),

  -- Variant state
  status              text NOT NULL DEFAULT 'draft'
    CONSTRAINT template_variants_status_check
      CHECK (status IN ('draft', 'active', 'archived')),

  -- The actual layout/scene data for this platform render
  scene_json          jsonb,
  visual_html         text,
  cover_image_url     text,

  -- Authorship
  created_by          uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX template_variants_template_id_idx
  ON public.template_variants (template_id);

CREATE INDEX template_variants_platform_id_idx
  ON public.template_variants (platform_id);

CREATE INDEX template_variants_status_idx
  ON public.template_variants (status)
  WHERE status = 'active';

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_template_variants_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER template_variants_updated_at
  BEFORE UPDATE ON public.template_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_template_variants_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.template_variants ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read active variants
CREATE POLICY "Authenticated users can read active variants"
  ON public.template_variants
  FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Admins can read all variants regardless of status
CREATE POLICY "Admins can read all variants"
  ON public.template_variants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Only admins can insert
CREATE POLICY "Admins can insert variants"
  ON public.template_variants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Only admins can update
CREATE POLICY "Admins can update variants"
  ON public.template_variants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Only admins can delete
CREATE POLICY "Admins can delete variants"
  ON public.template_variants
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );