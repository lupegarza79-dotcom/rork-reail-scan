-- Verification SQL — run in Supabase SQL Editor after `supabase db push`
-- Checks: table existence, RLS status, migration versions

SELECT '=== TABLE EXISTENCE ===' AS section;

SELECT
  unnest(ARRAY[
    'scan_results','scan_evidence','scan_reports','scan_cache',
    'rate_limits','scan_telemetry_events',
    'wallet_share_links','money_cases','case_events','case_artifacts',
    'domain_trust_profiles','domain_scan_edges','domain_relationships',
    'appeals','claims',
    'trustops_audit_runs','trustops_outcomes','trustops_notifications'
  ]) AS table_name,
  CASE WHEN to_regclass('public.' || unnest(ARRAY[
    'scan_results','scan_evidence','scan_reports','scan_cache',
    'rate_limits','scan_telemetry_events',
    'wallet_share_links','money_cases','case_events','case_artifacts',
    'domain_trust_profiles','domain_scan_edges','domain_relationships',
    'appeals','claims',
    'trustops_audit_runs','trustops_outcomes','trustops_notifications'
  ])) IS NOT NULL THEN 'EXISTS' ELSE '** MISSING **' END AS status;

SELECT '=== RLS STATUS ===' AS section;

SELECT
  t.tablename,
  CASE WHEN t.rowsecurity THEN 'ENABLED' ELSE '** DISABLED **' END AS rls_status
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

SELECT '=== MIGRATION VERSIONS ===' AS section;

SELECT version, name, statements_applied_at
FROM supabase_migrations.schema_migrations
ORDER BY version;
