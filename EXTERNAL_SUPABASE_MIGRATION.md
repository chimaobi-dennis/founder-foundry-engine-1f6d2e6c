# External Supabase Migration Guide

This guide will help you migrate from Lovable Cloud's managed Supabase to your own external Supabase project, giving you full control over your database and user data.

## Why External Supabase?

- **Full ownership** of your database and user data
- **Direct access** to Supabase dashboard and SQL editor
- **Custom database policies** and configurations
- **Data export/backup** capabilities
- **Production-ready** infrastructure under your control

## Prerequisites

1. Create a Supabase account at https://supabase.com
2. Create a new project in your Supabase organization
3. Note down your project credentials (you'll need these)

## Step 1: Get Your External Supabase Credentials

From your Supabase project dashboard:

1. Go to **Project Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJhbGci...`)
   - **service_role key** (for edge functions - keep this secret!)

## Step 2: Required Environment Variables

When you self-host or deploy this project, you'll need to set these environment variables:

### Frontend (.env)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...your-anon-key
```

### Edge Functions (Supabase Secrets)
```bash
LOVABLE_API_KEY=your-lovable-api-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 3: Database Schema Setup

Your application uses the following Supabase features that need to be set up:

### Authentication
- Email/password authentication
- OAuth providers (if configured)
- User metadata storage

### Edge Functions
The following edge functions need to be deployed:
1. **ai-call** - Handles AI generation requests
2. **mentor-chat** - Powers the mentor chat feature
3. **detect-milestone** - Milestone detection functionality

### Database Tables
Based on your TypeScript types, you'll need to create these tables:
- User profiles
- Brand data
- Campaign data
- Content data
- Any other custom tables

## Step 4: Migration Path Options

### Option A: Self-Host via GitHub (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

2. **Clone locally**
   ```bash
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo
   ```

3. **Set up environment variables**
   Create a `.env.local` file (not tracked in git):
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Link to your Supabase project**
   ```bash
   npx supabase link --project-ref your-project-ref
   ```

6. **Deploy edge functions**
   ```bash
   npx supabase functions deploy ai-call
   npx supabase functions deploy mentor-chat
   npx supabase functions deploy detect-milestone
   ```

7. **Set edge function secrets**
   ```bash
   npx supabase secrets set LOVABLE_API_KEY=your-key
   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

8. **Run locally**
   ```bash
   npm run dev
   ```

### Option B: Deploy to Vercel/Netlify

1. Connect your GitHub repository to Vercel/Netlify
2. Set environment variables in the deployment platform:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Deploy edge functions separately to Supabase
4. Your app will now use your external Supabase

## Step 5: Data Migration (If Needed)

If you have existing data in Lovable Cloud's Supabase:

1. **Export data** from Lovable Cloud (if possible)
2. **Import to your Supabase** using SQL or the dashboard
3. Or start fresh with your external Supabase

## Step 6: Update Supabase Config

Update `/supabase/config.toml` with your project ID:

```toml
project_id = "your-external-project-id"

[functions.ai-call]
verify_jwt = false

[functions.mentor-chat]
verify_jwt = false

[functions.detect-milestone]
verify_jwt = false
```

## Current Project Configuration

Your project currently uses:
- **Project ID**: `wayprzekrmgocjdjnfjw` (Lovable Cloud)
- **3 Edge Functions**: ai-call, mentor-chat, detect-milestone
- **Auth**: localStorage-based session persistence

## Security Considerations

1. **Never commit** `.env` files with real credentials to git
2. **Use `.env.local`** for local development
3. **Set secrets** via platform environment variables in production
4. **Rotate keys** if they're ever exposed
5. **Enable RLS** (Row Level Security) on all tables in Supabase

## Testing Your Migration

1. **Test authentication** - Sign up/login works
2. **Test AI generation** - ProStudio templates generate correctly
3. **Test mentor chat** - Chat functionality works
4. **Test data persistence** - Data saves to your database
5. **Check edge functions** - All functions respond correctly

## Deployment Checklist

- [ ] External Supabase project created
- [ ] Database schema set up
- [ ] Edge functions deployed
- [ ] Environment variables configured
- [ ] Authentication working
- [ ] AI features working
- [ ] Data persisting correctly
- [ ] Production deployment tested

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase CLI**: https://supabase.com/docs/guides/cli
- **Edge Functions**: https://supabase.com/docs/guides/functions
- **Database Migrations**: https://supabase.com/docs/guides/database/migrations

## Next Steps

1. Create your external Supabase project
2. Set up the database schema
3. Deploy edge functions
4. Update environment variables
5. Test thoroughly
6. Deploy to production

You now have **full control** over your database, user data, and infrastructure!
