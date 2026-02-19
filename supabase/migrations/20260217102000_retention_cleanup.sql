-- Retention policy: keep scans for N days (default 8), then require re-scan.

create or replace function public.cleanup_old_scans(retain_days int default 8)
returns int
language plpgsql
as $$
declare
  deleted_count int := 0;
begin
  -- Keep scan_results for retain_days; scan_evidence cascades via FK if configured that way.
  delete from public.scan_results
  where created_at < now() - (retain_days || ' days')::interval;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Optional: also clean old scan_reports if you want
-- (uncomment if you want reports purged too)
-- delete from public.scan_reports
-- where created_at < now() - (retain_days || ' days')::interval;
