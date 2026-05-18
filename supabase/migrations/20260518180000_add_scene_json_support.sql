-- ============================================================
-- Migration: Add Scene JSON support to existing tables
-- Description: Adds scene_json, render_engine, and scene_version
--              columns to support structured scene rendering
--              alongside existing HTML rendering.
-- IMPORTANT: This is ADDITIVE only. No existing columns are removed.
-- ============================================================

-- ─── content_studio_creatives ────────────────────────────────
ALTER TABLE content_studio_creatives
  ADD COLUMN IF NOT EXISTS scene_json JSONB,
  ADD COLUMN IF NOT EXISTS render_engine TEXT NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS scene_version TEXT NOT NULL DEFAULT 'v1';

COMMENT ON COLUMN content_studio_creatives.scene_json IS 'Structured scene document (JSON) for the scene renderer. NULL when render_engine is html.';
COMMENT ON COLUMN content_studio_creatives.render_engine IS 'Which renderer the frontend should use: html (legacy) or scene (new).';
COMMENT ON COLUMN content_studio_creatives.scene_version IS 'Schema version of the scene_json document.';

-- ─── studio_sessions ─────────────────────────────────────────
ALTER TABLE studio_sessions
  ADD COLUMN IF NOT EXISTS scene_json JSONB,
  ADD COLUMN IF NOT EXISTS render_engine TEXT NOT NULL DEFAULT 'html';

COMMENT ON COLUMN studio_sessions.scene_json IS 'Structured scene document (JSON) for the scene renderer. NULL when render_engine is html.';
COMMENT ON COLUMN studio_sessions.render_engine IS 'Which renderer the frontend should use: html (legacy) or scene (new).';

-- ─── template_outputs ────────────────────────────────────────
ALTER TABLE template_outputs
  ADD COLUMN IF NOT EXISTS scene_json JSONB,
  ADD COLUMN IF NOT EXISTS render_engine TEXT NOT NULL DEFAULT 'html';

COMMENT ON COLUMN template_outputs.scene_json IS 'Structured scene document (JSON) for the scene renderer. NULL when render_engine is html.';
COMMENT ON COLUMN template_outputs.render_engine IS 'Which renderer the frontend should use: html (legacy) or scene (new).';
