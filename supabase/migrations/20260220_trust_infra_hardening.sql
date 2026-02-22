-- Migration: Trust Infrastructure Hardening
-- Purpose: telemetry trace_id + metadata, cache indexes, new provider enum values,
--          cleanup RPCs, dashboard views. All additive + idempotent.

-- 0) Drift repair: ensure scan_cache exists (required by cache indexes + cleanup RPC)
CREATE TABLE IF NOT EXISTS scan_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 1) Telemetry: add trace_id + metadata columns
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_telemetry_trace_id ON scan_telemetry_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_endpoint_created ON scan_telemetry_events(endpoint, created_at DESC);

-- 2) scan_cache: ensure composite index for key + expires_at lookups
CREATE INDEX IF NOT EXISTS idx_scan_cache_key_expires ON scan_cache(key, expires_at);

-- 3) rate_limits: ensure composite lookup index
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(endpoint, device_id, ip, window_end DESC);

-- 4) New provider enum values for urlscan.io, URLhaus, OpenPhish
DO $$ BEGIN
  ALTER TYPE evidence_provider ADD VALUE IF NOT EXISTS 'urlscan_io';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE evidence_provider ADD VALUE IF NOT EXISTS 'urlhaus';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE evidence_provider ADD VALUE IF NOT EXISTS 'openphish';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE evidence_provider ADD VALUE IF NOT EXISTS 'content_intel';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5) Cleanup RPCs (idempotent CREATE OR REPLACE)

CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM scan_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_expired_share_links()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM wallet_share_links WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '2 hours';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_old_telemetry(retention_days INT DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM scan_telemetry_events
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.run_all_cleanup()
RETURNS JSONB AS $$
DECLARE
  cache_del INT;
  share_del INT;
  rate_del INT;
  telem_del INT;
BEGIN
  cache_del := public.cleanup_expired_cache();
  share_del := public.cleanup_expired_share_links();
  rate_del  := public.cleanup_old_rate_limits();
  telem_del := public.cleanup_old_telemetry(30);
  RETURN jsonb_build_object(
    'cache_deleted', cache_del,
    'share_links_deleted', share_del,
    'rate_limits_deleted', rate_del,
    'telemetry_deleted', telem_del,
    'ran_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Dashboard views

CREATE OR REPLACE VIEW telemetry_dashboard AS
SELECT
  date_trunc('hour', created_at) AS bucket,
  endpoint,
  COUNT(*) FILTER (WHERE event_type = 'scan') AS scan_count,
  COUNT(*) FILTER (WHERE event_type = 'scan' AND cache_hit = true) AS cache_hits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 'scan' AND cache_hit = true)
    / NULLIF(COUNT(*) FILTER (WHERE event_type = 'scan'), 0), 2) AS cache_hit_pct,
  AVG(latency_ms) FILTER (WHERE event_type = 'scan' AND status = 'ok') AS avg_scan_latency_ms,
  COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limit_hits,
  COUNT(*) FILTER (WHERE status = 'error') AS error_count
FROM scan_telemetry_events
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

CREATE OR REPLACE VIEW provider_dashboard AS
SELECT
  date_trunc('hour', created_at) AS bucket,
  provider,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE success = true) AS successes,
  COUNT(*) FILTER (WHERE success = false) AS failures,
  ROUND(AVG(latency_ms)::numeric, 0) AS avg_latency_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)
    FILTER (WHERE latency_ms IS NOT NULL)::numeric, 0) AS p95_latency_ms
FROM scan_telemetry_events
WHERE event_type = 'provider'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
