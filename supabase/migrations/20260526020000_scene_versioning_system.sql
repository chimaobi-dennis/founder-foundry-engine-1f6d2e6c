-- Scene Versioning System
-- Production-grade version history for Content Studio
-- Snapshot + patch architecture with compressed storage

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENUMS (must be created BEFORE tables that use them)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Version type: manual (user save), auto (autosave), named (bookmark), system, restore
DO $$ BEGIN
  CREATE TYPE creative_version_type AS ENUM ('manual', 'auto', 'named', 'system', 'restore');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Source of version creation
DO $$ BEGIN
  CREATE TYPE version_source_type AS ENUM (
    'initial_generation', 'ai_regenerate', 'ai_rewrite', 'user_edit', 'user_mutation',
    'manual_save', 'auto_snapshot', 'pre_export', 'pre_delete', 'restore',
    'platform_switch', 'layout_change', 'style_change', 'node_add', 'node_delete',
    'node_modify', 'copy_edit', 'visual_edit', 'batch_operation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Snapshot storage strategy
DO $$ BEGIN
  CREATE TYPE snapshot_storage_type AS ENUM ('full', 'patch', 'reference');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reason for creating a compressed snapshot
DO $$ BEGIN
  CREATE TYPE snapshot_reason_type AS ENUM (
    'periodic', 'pre_mutation', 'post_mutation', 'user_request', 'compression', 'restore_point'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Annotation type on versions
DO $$ BEGIN
  CREATE TYPE annotation_type AS ENUM ('note', 'tag', 'bookmark');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: creative_versions
-- Stores version snapshots with patch-based diff storage
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE creative_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  creative_id UUID NOT NULL REFERENCES content_studio_creatives(id) ON DELETE CASCADE,
  brief_id UUID NOT NULL REFERENCES content_studio_briefs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Version metadata
  version_number INTEGER NOT NULL,
  version_name VARCHAR(255),
  version_type creative_version_type NOT NULL DEFAULT 'auto',
  
  -- Source tracking (what triggered this version)
  source_type version_source_type NOT NULL,
  source_action VARCHAR(100),
  source_metadata JSONB, -- flexible metadata based on source
  
  -- Content snapshot (full or reference)
  snapshot_type snapshot_storage_type NOT NULL DEFAULT 'full',
  content_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for integrity
  
  -- Scene content (for scene mode)
  scene_json JSONB,
  scene_patch JSONB, -- null if full snapshot, otherwise patch from previous
  
  -- HTML content (for HTML mode)
  visual_html TEXT,
  visual_patch JSONB, -- structured patch for HTML changes
  
  -- Copy/content
  copy_text TEXT,
  headline TEXT,
  subject_line TEXT,
  hashtags TEXT[],
  
  -- Change metrics
  change_summary VARCHAR(500), -- human-readable summary
  nodes_added INTEGER DEFAULT 0,
  nodes_modified INTEGER DEFAULT 0,
  nodes_deleted INTEGER DEFAULT 0,
  nodes_unchanged INTEGER DEFAULT 0,
  change_size_bytes INTEGER, -- approximate size of changes
  
  -- Restore metadata
  restored_from_version_id UUID REFERENCES creative_versions(id),
  is_restored_version BOOLEAN DEFAULT FALSE,
  
  -- Parent/lineage tracking
  parent_version_id UUID REFERENCES creative_versions(id),
  is_current BOOLEAN DEFAULT FALSE, -- flag for quick "current" lookup
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_version_number_per_creative UNIQUE (creative_id, version_number),
  CONSTRAINT no_future_versions CHECK (created_at <= NOW() + INTERVAL '1 minute')
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: version_snapshots
-- Compressed full snapshots stored periodically for reconstruction
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE version_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID NOT NULL REFERENCES content_studio_creatives(id) ON DELETE CASCADE,
  
  -- Snapshot metadata
  snapshot_reason snapshot_reason_type NOT NULL DEFAULT 'periodic',
  version_range_start INTEGER NOT NULL, -- inclusive
  version_range_end INTEGER NOT NULL,   -- inclusive
  
  -- Compressed content
  compressed_scene_json BYTEA, -- compressed full scene for reconstruction
  compression_algorithm VARCHAR(20) DEFAULT 'zstd',
  original_size_bytes INTEGER,
  compressed_size_bytes INTEGER,
  
  -- Integrity
  content_hash VARCHAR(64) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_version_range CHECK (version_range_start <= version_range_end)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: version_annotations
-- User notes/tags on specific versions
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE version_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  annotation_type annotation_type NOT NULL DEFAULT 'note',
  content TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Version lookups
CREATE INDEX idx_creative_versions_creative_id ON creative_versions(creative_id);
CREATE INDEX idx_creative_versions_brief_id ON creative_versions(brief_id);
CREATE INDEX idx_creative_versions_user_id ON creative_versions(user_id);
CREATE INDEX idx_creative_versions_current ON creative_versions(creative_id, is_current) WHERE is_current = TRUE;
CREATE INDEX idx_creative_versions_created ON creative_versions(creative_id, created_at DESC);
CREATE INDEX idx_creative_versions_type ON creative_versions(creative_id, version_type);
CREATE INDEX idx_creative_versions_source ON creative_versions(source_type);

-- Snapshot lookups
CREATE INDEX idx_version_snapshots_creative_id ON version_snapshots(creative_id);
CREATE INDEX idx_version_snapshots_range ON version_snapshots(creative_id, version_range_start, version_range_end);

-- Annotation lookups
CREATE INDEX idx_version_annotations_version_id ON version_annotations(version_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Get next version number for a creative
CREATE OR REPLACE FUNCTION get_next_version_number(p_creative_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_max_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_max_number
  FROM creative_versions
  WHERE creative_id = p_creative_id;
  
  RETURN v_max_number;
END;
$$ LANGUAGE plpgsql;

-- Mark previous versions as not current
CREATE OR REPLACE FUNCTION mark_previous_versions_not_current()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE creative_versions
  SET is_current = FALSE
  WHERE creative_id = NEW.creative_id
  AND id != NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mark_current_version
  AFTER INSERT ON creative_versions
  FOR EACH ROW
  WHEN (NEW.is_current = TRUE)
  EXECUTE FUNCTION mark_previous_versions_not_current();

-- Get version lineage (all ancestors up to root)
CREATE OR REPLACE FUNCTION get_version_lineage(p_version_id UUID)
RETURNS TABLE (
  version_id UUID,
  version_number INTEGER,
  version_name VARCHAR(255),
  created_at TIMESTAMPTZ,
  depth INTEGER
) AS $$
WITH RECURSIVE lineage AS (
  -- Base case: start from given version
  SELECT 
    cv.id,
    cv.version_number,
    cv.version_name,
    cv.created_at,
    cv.parent_version_id,
    0 as depth
  FROM creative_versions cv
  WHERE cv.id = p_version_id
  
  UNION ALL
  
  -- Recursive case: get parent
  SELECT 
    cv.id,
    cv.version_number,
    cv.version_name,
    cv.created_at,
    cv.parent_version_id,
    l.depth + 1
  FROM creative_versions cv
  INNER JOIN lineage l ON cv.id = l.parent_version_id
)
SELECT 
  l.id as version_id,
  l.version_number,
  l.version_name,
  l.created_at,
  l.depth
FROM lineage l
ORDER BY l.depth;
$$ LANGUAGE sql STABLE;

-- Calculate diff between two versions (node-level)
CREATE OR REPLACE FUNCTION calculate_version_diff(
  p_from_version_id UUID,
  p_to_version_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_from_scene JSONB;
  v_to_scene JSONB;
  v_result JSONB;
BEGIN
  SELECT scene_json INTO v_from_scene
  FROM creative_versions
  WHERE id = p_from_version_id;
  
  SELECT scene_json INTO v_to_scene
  FROM creative_versions
  WHERE id = p_to_version_id;
  
  -- Return structural diff
  SELECT jsonb_build_object(
    'added_nodes', (
      SELECT jsonb_agg(node->>'id')
      FROM jsonb_array_elements(v_to_scene->'nodes') AS node
      WHERE (node->>'id') NOT IN (
        SELECT (n->>'id') FROM jsonb_array_elements(v_from_scene->'nodes') AS n
      )
    ),
    'removed_nodes', (
      SELECT jsonb_agg(node->>'id')
      FROM jsonb_array_elements(v_from_scene->'nodes') AS node
      WHERE (node->>'id') NOT IN (
        SELECT (n->>'id') FROM jsonb_array_elements(v_to_scene->'nodes') AS n
      )
    ),
    'from_hash', MD5(v_from_scene::text),
    'to_hash', MD5(v_to_scene::text)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Get current version for a creative
CREATE OR REPLACE FUNCTION get_current_version(p_creative_id UUID)
RETURNS UUID AS $$
DECLARE
  v_version_id UUID;
BEGIN
  SELECT id INTO v_version_id
  FROM creative_versions
  WHERE creative_id = p_creative_id
  AND is_current = TRUE
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Prune old versions (keep N most recent + all named versions)
CREATE OR REPLACE FUNCTION prune_old_versions(
  p_creative_id UUID,
  p_keep_count INTEGER DEFAULT 50
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  WITH versions_to_keep AS (
    SELECT id
    FROM creative_versions
    WHERE creative_id = p_creative_id
    AND (version_type IN ('manual', 'named') OR is_restored_version = TRUE)
    
    UNION
    
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
      FROM creative_versions
      WHERE creative_id = p_creative_id
    ) ranked
    WHERE rn <= p_keep_count
  )
  DELETE FROM creative_versions
  WHERE creative_id = p_creative_id
  AND id NOT IN (SELECT id FROM versions_to_keep)
  AND is_current = FALSE;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE creative_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_annotations ENABLE ROW LEVEL SECURITY;

-- Users can view versions for creatives they have access to
CREATE POLICY "Users can view their creative versions"
  ON creative_versions FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM content_studio_creatives c
      JOIN content_studio_briefs b ON c.brief_id = b.id
      WHERE c.id = creative_versions.creative_id
      AND b.user_id = auth.uid()
    )
  );

-- Users can create versions for their creatives
CREATE POLICY "Users can create versions for their creatives"
  ON creative_versions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM content_studio_creatives c
      JOIN content_studio_briefs b ON c.brief_id = b.id
      WHERE c.id = creative_versions.creative_id
      AND b.user_id = auth.uid()
    )
  );

-- Users can update their own versions (mainly for naming)
CREATE POLICY "Users can update their version names"
  ON creative_versions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Snapshot policies
CREATE POLICY "Users can view snapshots for their creatives"
  ON version_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content_studio_creatives c
      JOIN content_studio_briefs b ON c.brief_id = b.id
      WHERE c.id = version_snapshots.creative_id
      AND b.user_id = auth.uid()
    )
  );

-- Annotation policies
CREATE POLICY "Users can manage their annotations"
  ON version_annotations FOR ALL
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Convenient view for version history with human-readable info
CREATE OR REPLACE VIEW version_history_view AS
SELECT 
  cv.id,
  cv.creative_id,
  cv.brief_id,
  cv.user_id,
  cv.version_number,
  cv.version_name,
  cv.version_type,
  cv.source_type,
  cv.source_action,
  cv.change_summary,
  cv.nodes_added,
  cv.nodes_modified,
  cv.nodes_deleted,
  cv.is_current,
  cv.is_restored_version,
  cv.created_at,
  cv.parent_version_id,
  cv.restored_from_version_id,
  -- Human-readable age
  CASE 
    WHEN cv.created_at > NOW() - INTERVAL '1 minute' THEN 'Just now'
    WHEN cv.created_at > NOW() - INTERVAL '1 hour' THEN 
      EXTRACT(MINUTE FROM NOW() - cv.created_at)::text || 'm ago'
    WHEN cv.created_at > NOW() - INTERVAL '1 day' THEN 
      EXTRACT(HOUR FROM NOW() - cv.created_at)::text || 'h ago'
    WHEN cv.created_at > NOW() - INTERVAL '7 days' THEN 
      EXTRACT(DAY FROM NOW() - cv.created_at)::text || 'd ago'
    ELSE TO_CHAR(cv.created_at, 'Mon DD')
  END as age_text
FROM creative_versions cv;

COMMENT ON TABLE creative_versions IS 'Stores version history for creative content with snapshot/patch architecture';
COMMENT ON TABLE version_snapshots IS 'Compressed periodic snapshots for efficient version reconstruction';
COMMENT ON TABLE version_annotations IS 'User notes and bookmarks on specific versions';
