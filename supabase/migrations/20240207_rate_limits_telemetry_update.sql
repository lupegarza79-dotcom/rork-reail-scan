-- Migration: extend rate limits + telemetry metadata

-- 1) Extend rate_limits with identifiers and limits
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS function_name TEXT;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS limit_value INTEGER;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rate_limits_identity ON rate_limits(function_name, device_id, ip, window_end);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rate_limits_window ON rate_limits(function_name, device_id, ip, window_start);

-- 2) Extend telemetry events with scan metadata
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS scan_id UUID;
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS badge TEXT;

-- 3) Refresh telemetry summary view with cache-hit rate and p95 latency
CREATE OR REPLACE VIEW telemetry_summary AS
SELECT
  date_trunc('hour', created_at) AS bucket,
  function_name,
  COUNT(*) FILTER (WHERE event_type = 'scan') AS scan_count,
  COUNT(*) FILTER (WHERE event_type = 'scan' AND cache_hit = true) AS cache_hit_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 'scan' AND cache_hit = true)
    / NULLIF(COUNT(*) FILTER (WHERE event_type = 'scan'), 0), 2) AS cache_hit_rate,
  AVG(latency_ms) FILTER (WHERE event_type = 'provider') AS avg_provider_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)
    FILTER (WHERE event_type = 'provider' AND latency_ms IS NOT NULL) AS p95_provider_latency_ms,
  COUNT(*) FILTER (WHERE event_type = 'provider' AND success = false) AS provider_error_count
FROM scan_telemetry_events
GROUP BY 1, 2;
