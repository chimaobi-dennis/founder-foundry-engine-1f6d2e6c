-- Kinika · Disk IO diagnostics. Read-only. Run in the SQL editor (or
-- `supabase db query --linked -f supabase/sql/diagnostics_io.sql`) when the
-- database answers again. Each block is independent.

-- 1. Who is reading/writing the most disk (needs pg_stat_statements, on by default)
SELECT left(regexp_replace(query, '\s+', ' ', 'g'), 110) AS query,
       calls,
       round(total_exec_time::numeric / 1000, 1) AS total_s,
       shared_blks_read + shared_blks_written + temp_blks_read + temp_blks_written AS disk_blocks,
       round((shared_blks_read + shared_blks_written + temp_blks_read + temp_blks_written) * 8 / 1024.0, 1) AS disk_mb
FROM pg_stat_statements
ORDER BY disk_blocks DESC
LIMIT 15;

-- 2. Most-called statements (polling shows up here)
SELECT left(regexp_replace(query, '\s+', ' ', 'g'), 110) AS query, calls, round(mean_exec_time::numeric, 2) AS mean_ms
FROM pg_stat_statements ORDER BY calls DESC LIMIT 15;

-- 3. Tables by size, with sequential scans and dead rows (bloat → vacuum IO)
SELECT relname,
       pg_size_pretty(pg_total_relation_size(relid)) AS total,
       seq_scan, idx_scan, n_live_tup, n_dead_tup,
       last_autovacuum
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- 4. What is running right now and for how long
SELECT pid, state, now() - query_start AS running_for, wait_event_type, left(query, 120) AS query
FROM pg_stat_activity
WHERE datname = current_database() AND state <> 'idle' AND pid <> pg_backend_pid()
ORDER BY query_start;

-- 5. The runner tick: how long each cron run took lately, and any failures
SELECT jobid, status, start_time, end_time - start_time AS took, left(return_message, 80) AS msg
FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- 6. pg_net response backlog (one row per tick until it is cleaned up)
SELECT count(*) AS http_responses, min(created) AS oldest FROM net._http_response;
