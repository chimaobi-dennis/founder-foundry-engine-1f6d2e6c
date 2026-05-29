-- Migration: Add selected_library_assets column to content_studio_briefs
-- Created: 2026-05-29

-- Add the column to store selected library assets for AI context
ALTER TABLE public.content_studio_briefs
ADD COLUMN IF NOT EXISTS selected_library_assets jsonb DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.content_studio_briefs.selected_library_assets IS 
'JSON array of selected assets from the library for AI context. Format: [{id, type, imageUrl}]';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
