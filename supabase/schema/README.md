# Live schema snapshots

`supabase db dump --linked -s public` output from the production project, kept
as a reference because the committed migrations do not fully describe the live
database (the Lovable-era tables and constraints were never captured as
migrations). Check here before relying on a column, constraint or function
body; two production bugs in October 2026 came from constraints that existed
only on the live database.

These files are **not** migrations and are never applied. Refresh with:

```bash
supabase db dump --linked -s public -f supabase/schema/live_public_schema_$(date +%F).sql
```
