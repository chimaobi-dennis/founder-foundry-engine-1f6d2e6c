# FounderForge — Project Context for Claude Code

## What This Is
An AI brand platform for founders and small business owners.
A thinking partner and creative suite that remembers the
user's brand and powers all marketing outputs from that memory.

## Tech Stack
- Frontend: React + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Supabase (Auth + Postgres + Storage)
- Build tool: Vite
- Deployment: Vercel
- AI: Lovable AI native integration (Gemini 3 Flash default,
  Nano Banana 2 for image generation)

## Supabase
- External Supabase project (not Lovable Cloud)
- Client: src/integrations/supabase/client.ts
- All tables have RLS enabled
- Never create new Supabase clients — always import from the existing client file

## Environment Variables
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

## Database Tables
Phase 1 — Foundation:
- profiles (extends auth.users — id, full_name, email, role,
  plan, credits_remaining, onboarding_completed, profession,
  brand_status, team_size)
- brands (user_id → profiles — name, primary_color,
  secondary_color, is_active, completeness_score,
  active_product_image_id)
- brand_dna (brand_id → brands 1:1 — brand_voice,
  positioning_statement, core_promise, target_audience,
  brand_references, tone_descriptors, brand_feel,
  campaign_strategy, customer_insight, product_positioning)

Phase 2 — Templates:
- creator_profiles (id → auth.users — display_name,
  is_approved)
- prostudio_templates (creator_id → auth.users — name, slug,
  template_type, category, generation_prompt, cover_image_url,
  status, uses_count)
- template_preview_images (template_id → prostudio_templates —
  image_url, is_cover, sort_order)
- template_outputs (template_id, user_id, brand_id —
  output_html, output_image_url, variation_index,
  is_saved_to_library)
- template_saves (template_id, user_id — unique constraint)
- creator_applications (user_id — why_apply,
  prompt_engineering_experience, sample_prompt, status)

Phase 3 — Modules:
- mentor_conversations (brand_id → brands 1:1)
- mentor_messages (conversation_id — role, content)
- milestones (brand_id, conversation_id — name, category,
  message_id)
- assets (brand_id, user_id — name, type, source_module,
  file_url, platform, times_used)
- campaigns (brand_id, user_id — name, product_name,
  campaign_goal, tone, asset_id, status)
- campaign_creatives (campaign_id — platform, copy_text,
  subject_line, asset_id)
- calendar_posts (brand_id, user_id — platform,
  scheduled_date, scheduled_time, copy_text, asset_id,
  reminder_enabled, status)
- documents (brand_id, user_id — name, document_type,
  generated_html, asset_id)
- reels (brand_id, user_id — name, platform,
  duration_seconds, goal)
- reel_scenes (reel_id — scene_number, voiceover,
  on_screen_text, visual_direction)

## Service Layer Files
All Supabase calls go through service files — never call
Supabase directly from components.

- src/services/brandService.ts — brand and brand DNA
- src/services/templateService.ts — ProStudio templates
- src/services/creatorService.ts — creator applications
- src/services/adminService.ts — admin dashboard data

## Context Files
- src/contexts/AuthContext.tsx — session, user, signOut
- src/contexts/BrandContext.tsx — brands, activeBrand,
  activeBrandDNA, switchBrand, createNewBrand

## User Roles
- founder (default) — uses the platform
- creator (approved) — publishes templates in Creator Studio
- admin — manages the platform via Admin Interface

Role is stored in profiles.role
Check role via: const { data: profile } = await supabase
  .from('profiles').select('role').eq('id', user.id).single()

## Six Modules
1. Mentor — AI thinking partner. One continuous conversation
   per brand. Milestone save points. Brand DNA extracted
   from conversation progressively.
2. ProStudio — Template marketplace. Physical and digital
   product visuals. Templates fetched from Supabase.
3. CampaignKit — Brief to 8 platform creatives. Image +
   copy per platform.
4. ContentCalendar — Planning only in v1. No auto-posting.
   Manual posting with email reminders.
5. DocStudio — 8 document types. Generated HTML preview.
   Export as PDF/DOCX.
6. ReelBuilder — Brief to storyboard. Teleprompter mode.
   Template marketplace.

## Design System
Background dark: #0D1B2A
Background light: #F5F2EC
Card dark: #1A2A3A
Card light: #FFFFFF
Border dark: #2A3A4A
Border light: #E8E2D9
Amber accent: #D4A017
Text primary dark: #F5F0E8
Text primary light: #1A1A2E
Text muted: #8A96A3
Font display: Playfair Display
Font body: DM Sans

## Key Rules
1. Never make direct Supabase calls from React components
2. Always use service layer functions
3. Never run database migrations — schema changes go through
   Supabase dashboard SQL editor manually
4. Always use existing Supabase client from
   src/integrations/supabase/client.ts
5. Follow existing component patterns and design system
6. Never hardcode user IDs or credentials
7. Always handle loading and error states
8. TypeScript strict — no any types without good reason

## Current Priority
Wiring all screens to real Supabase data.
Starting with brand context bar → home screen →
mentor → prostudio → campaignkit → contentcalendar →
docstudio → reelbuilder → library → brand DNA page.