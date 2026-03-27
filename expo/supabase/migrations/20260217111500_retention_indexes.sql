create index if not exists scan_results_created_at_idx
  on public.scan_results (created_at);

-- si luego decides también borrar scan_reports por created_at:
-- create index if not exists scan_reports_created_at_idx
--   on public.scan_reports (created_at);
