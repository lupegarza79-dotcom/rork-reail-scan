-- Post-push verification SQL — run in Supabase SQL Editor after `supabase db push`
-- Checks: table existence, RLS enabled, migration version list

-- 1) TABLE EXISTENCE
SELECT 'TABLE CHECK' AS check_type,
       t.name AS table_name,
       CASE WHEN to_regclass('public.' || t.name) IS NOT NULL
            THEN 'OK' ELSE '** MISSING **' END AS status
FROM (VALUES
  ('scan_results'),('scan_evidence'),('scan_reports'),('scan_cache'),
  ('rate_limits'),('scan_telemetry_events'),
  ('wallet_share_links'),('money_cases'),('case_events'),('case_artifacts'),
  ('domain_trust_profiles'),('domain_scan_edges'),('domain_relationships'),
  ('appeals'),('claims'),
  ('trustops_audit_runs'),('trustops_outcomes'),('trustops_notifications')
) AS t(name)
ORDER BY t.name;

-- 2) RLS ENABLED
SELECT 'RLS CHECK' AS check_type,
       t.tablename,
       CASE WHEN t.rowsecurity THEN 'ENABLED' ELSE '** DISABLED **' END AS rls
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'scan_results','scan_evidence','scan_reports','scan_cache',
    'rate_limits','scan_telemetry_events',
    'wallet_share_links','money_cases','case_events','case_artifacts',
    'domain_trust_profiles','domain_scan_edges','domain_relationships',
    'appeals','claims',
    'trustops_audit_runs','trustops_outcomes','trustops_notifications'
  )
ORDER BY t.tablename;

-- 3) MIGRATION VERSIONS (should be strictly increasing, no duplicates)
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
