-- Retention policy: keep scan records for N days (default 8), then require re-scan.
-- This migration ONLY defines the function. Scheduling is handled separately (pg_cron).

create or replace function public.cleanup_old_scans(retain_days int default 8)
returns int
language plpgsql
as $$
declare
  deleted_count int := 0;
begin
  -- Delete old scan_results; related rows should cascade if FKs are configured with ON DELETE CASCADE.
  delete from public.scan_results
  where created_at < now() - (retain_days || ' days')::interval;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
