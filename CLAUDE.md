# FounderForge (working title) — Project Context

## What This Is
An AI brand platform for founders and small business owners. 
A thinking partner and creative suite that remembers the 
user's brand and powers all marketing outputs from that memory.

## Tech Stack
- Frontend: React + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Supabase (Auth + Postgres + Storage)
- Deployment: Vercel
- AI: Lovable AI (Gemini 3 Flash default, Nano Banana 2 for images)

## Supabase Setup
All tables have RLS enabled. Every user-owned table 
uses auth.uid() for policy checks. 

## Database Tables (in dependency order)
Phase 1 — Foundation:
- profiles (extends auth.users)
- brands (user_id → profiles)
- brand_dna (brand_id → brands, 1:1)

Phase 2 — Templates:
- creator_profiles (id → auth.users)
- prostudio_templates (creator_id → auth.users)
- template_preview_images (template_id → prostudio_templates)
- template_outputs (user_id → auth.users, brand_id → brands)
- template_saves (template_id, user_id)
- creator_applications (user_id → auth.users)

Phase 3 — Modules:
- mentor_conversations (brand_id → brands, 1:1)
- mentor_messages (conversation_id → mentor_conversations)
- milestones (brand_id, conversation_id)
- assets (brand_id → brands, user_id → profiles)
- campaigns (brand_id, user_id)
- campaign_creatives (campaign_id → campaigns)
- calendar_posts (brand_id, user_id)
- documents (brand_id, user_id)
- reels (brand_id, user_id)
- reel_scenes (reel_id → reels)

## Six Modules
1. Mentor — AI thinking partner, one continuous conversation 
   per brand, milestone save points
2. ProStudio — Template marketplace for product photography 
   and digital visuals
3. CampaignKit — Brief to 8 platform creatives
4. ContentCalendar — Planning and scheduling (manual posting, 
   no auto-post in v1)
5. DocStudio — 8 document types powered by Brand DNA
6. ReelBuilder — Brief to storyboard to teleprompter

## Design System
- Background: #0D1B2A (dark), #F5F2EC (light)
- Accent: #D4A017 (amber)
- Cards: #1A2A3A dark / #FFFFFF light
- Borders: #2A3A4A
- Text primary: #F5F0E8 dark / #1A1A2E light
- Text muted: #8A96A3
- Fonts: Playfair Display (headings), DM Sans (body)

## Current State
- Full prototype built in Lovable
- GitHub connected
- External Supabase connected (replacing Lovable Cloud)
- Auth flow being wired up
- All 20 database tables created

## Environment Variables Needed
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

## Key Decisions
- Templates owned by approved creators, not admins
- One continuous conversation per brand in Mentor
- ContentCalendar is planning only in v1 — no auto-posting
- Brand DNA is built from Mentor conversations, never a form
- Library is infrastructure not a module (sits with Brand DNA 
  in sidebar)