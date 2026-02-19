create or replace function public.cleanup_old_scans_local(retain_days int default 8)
returns int
language plpgsql
as $$
declare
  local_ts timestamp;
begin
  local_ts := (now() at time zone 'America/Chicago');

  -- Robust: run anytime during 3am local hour (handles cron delays)
  if extract(hour from local_ts) = 3 then
    return public.cleanup_old_scans(retain_days);
  end if;

  return 0;
end;
$$;
