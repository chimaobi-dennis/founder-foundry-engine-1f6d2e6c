### Switch Lovable Preview to External Supabase

**Current state:** `.env` points to Lovable Cloud (`wayprzekrmgocjdjnfjw`). The preview build reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from this file.

**Goal:** Make the Lovable preview connect to the external Supabase (`ypwfruanfcaleuqhgskw`).

**Steps:**
1. Update `.env`:
   - `VITE_SUPABASE_URL` → `https://ypwfruanfcaleuqhgskw.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → external JWT anon key
   - `VITE_SUPABASE_PUBLISHABLE_KEY` → external JWT anon key (standard Supabase uses the same key)
   - `VITE_SUPABASE_PROJECT_ID` → `ypwfruanfcaleuqhgskw`

2. Update `EXTERNAL_SUPABASE_MIGRATION.md` documentation to reflect the current external project reference.

3. Verify the preview rebuilds successfully and the Supabase client initializes against the external project.

**Caveat:** Lovable Cloud may auto-regenerate `.env` on some operations. If that happens, these values will need to be re-applied.