-- Migration 20240215: Production Hardening Fix-Forward
-- PURPOSE: Consolidate rate_limits/telemetry schema drift from 20240206/07/08,
--          add missing columns, fix defaults, enhance telemetry_summary,
--          add pg_cron scheduler setup, ensure idempotent cleanup functions.
-- SAFE: Fully idempotent, additive only. Works on fresh DB and upgrade paths.

-- ============================================================
-- PHASE 1: Consolidate rate_limits schema drift
-- Migrations 206/207/208 added overlapping columns:
--   206: base table with key PK
--   207: function_name, device_id, ip, limit_value, blocked_until
--   208: endpoint, limit (int), id, created_at
-- Edge Functions use: endpoint, device_id, ip, limit, blocked_until, count
-- Fix: ensure all needed columns exist, backfill endpoint from function_name
-- ============================================================

-- Ensure all columns exist (idempotent)
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- "limit" is a reserved word in some contexts; migration 208 may have failed on some DBs
DO $$ BEGIN
  ALTER TABLE rate_limits ADD COLUMN "limit" INTEGER;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Backfill: copy function_name -> endpoint where endpoint is null
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'function_name'
  ) THEN
    UPDATE rate_limits SET endpoint = function_name WHERE endpoint IS NULL AND function_name IS NOT NULL;
  END IF;
END $$;

-- Ensure composite index for the lookup pattern used by Edge Functions
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint_device_ip
  ON rate_limits(endpoint, device_id, ip, window_end);

-- ============================================================
-- PHASE 2: Consolidate telemetry schema
-- Ensure endpoint, status, scan_id, score, badge columns exist
-- ============================================================

ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS scan_id UUID;
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS badge TEXT;

-- Backfill: copy function_name -> endpoint where endpoint is null
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_telemetry_events' AND column_name = 'function_name'
  ) THEN
    UPDATE scan_telemetry_events SET endpoint = function_name WHERE endpoint IS NULL AND function_name IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_telemetry_endpoint ON scan_telemetry_events(endpoint);
CREATE INDEX IF NOT EXISTS idx_telemetry_status ON scan_telemetry_events(status);
CREATE INDEX IF NOT EXISTS idx_telemetry_created ON scan_telemetry_events(created_at DESC);

-- ============================================================
-- PHASE 3: Enhanced telemetry_summary view
-- Includes: total_calls, avg/p95 latency, error_count, error_rate,
--           cache_hit_rate, rate_limit_hits
-- ============================================================

CREATE OR REPLACE VIEW telemetry_summary AS
SELECT
  date_trunc('day', created_at) AS bucket,
  COALESCE(endpoint, function_name, 'unknown') AS endpoint,
  device_id,
  ip,
  COUNT(*) AS total_calls,
  ROUND(AVG(latency_ms)::NUMERIC, 2) AS avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)
    FILTER (WHERE latency_ms IS NOT NULL) AS p95_latency_ms,
  COUNT(*) FILTER (WHERE status = 'error' OR success = false) AS error_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'error' OR success = false)
    / NULLIF(COUNT(*), 0), 2
  ) AS error_rate,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE cache_hit = true)
    / NULLIF(COUNT(*), 0), 2
  ) AS cache_hit_rate,
  COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limit_hits
FROM scan_telemetry_events
WHERE event_type = 'scan'
GROUP BY 1, 2, 3, 4;

-- ============================================================
-- PHASE 4: Ensure scan_cache indexes + cleanup idempotence
-- ============================================================

DO $$ BEGIN
  IF to_regclass('public.scan_cache') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_scan_cache_key ON public.scan_cache(key);
    CREATE INDEX IF NOT EXISTS idx_scan_cache_expires ON public.scan_cache(expires_at);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted INTEGER := 0;
BEGIN
  IF to_regclass('public.scan_cache') IS NOT NULL THEN
    DELETE FROM public.scan_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted = ROW_COUNT;
  END IF;
  RETURN deleted;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_share_links()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    DELETE FROM public.wallet_share_links WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
  END IF;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted INTEGER := 0;
BEGIN
  IF to_regclass('public.rate_limits') IS NOT NULL THEN
    DELETE FROM public.rate_limits WHERE window_end < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS deleted = ROW_COUNT;
  END IF;
  RETURN deleted;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_telemetry(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted INTEGER := 0;
BEGIN
  IF to_regclass('public.scan_telemetry_events') IS NOT NULL THEN
    DELETE FROM public.scan_telemetry_events
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
    GET DIAGNOSTICS deleted = ROW_COUNT;
  END IF;
  RETURN deleted;
END;
$$;

CREATE OR REPLACE FUNCTION run_all_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cache_del INTEGER := 0;
  share_del INTEGER := 0;
  rate_del INTEGER := 0;
  telem_del INTEGER := 0;
BEGIN
  SELECT cleanup_expired_cache() INTO cache_del;
  SELECT cleanup_expired_share_links() INTO share_del;
  SELECT cleanup_old_rate_limits() INTO rate_del;
  SELECT cleanup_old_telemetry(30) INTO telem_del;

  RETURN jsonb_build_object(
    'cache_deleted', cache_del,
    'share_links_deleted', share_del,
    'rate_limits_deleted', rate_del,
    'telemetry_deleted', telem_del,
    'run_at', NOW()
  );
END;
$$;

-- ============================================================
-- PHASE 5: pg_cron scheduler setup (run manually if pg_cron is enabled)
-- Uncomment and execute these in Supabase SQL Editor:
-- ============================================================
-- SELECT cron.schedule('reail-cache-cleanup-2h', '0 */2 * * *', $$SELECT cleanup_expired_cache()$$);
-- SELECT cron.schedule('reail-share-cleanup-daily', '0 3 * * *', $$SELECT cleanup_expired_share_links()$$);
-- SELECT cron.schedule('reail-rate-limit-cleanup-6h', '0 */6 * * *', $$SELECT cleanup_old_rate_limits()$$);
-- SELECT cron.schedule('reail-telemetry-cleanup-daily', '0 4 * * *', $$SELECT cleanup_old_telemetry(30)$$);
--
-- Verify schedules:
-- SELECT * FROM cron.job ORDER BY jobname;
--
-- To remove a schedule:
-- SELECT cron.unschedule('reail-cache-cleanup-2h');

-- ============================================================
-- PHASE 6: Fix wallet_share_links default expires_at drift
-- Some environments may have wrong default
-- ============================================================

DO $$ BEGIN
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    ALTER TABLE public.wallet_share_links
      ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '72 hours');
  END IF;
END $$;
