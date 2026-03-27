-- Migration: align rate limits + telemetry schema with Phase 1 requirements

-- 1) rate_limits: add identity + limit fields
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS limit INTEGER;
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint_identity ON rate_limits(endpoint, device_id, ip, window_end);

-- 2) scan_telemetry_events: add endpoint/status
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE scan_telemetry_events ADD COLUMN IF NOT EXISTS status TEXT;

CREATE INDEX IF NOT EXISTS idx_scan_telemetry_events_endpoint ON scan_telemetry_events(endpoint);

-- 3) telemetry_summary: aggregate by day + endpoint + device + ip
CREATE OR REPLACE VIEW telemetry_summary AS
SELECT
  date_trunc('day', created_at) AS bucket,
  endpoint,
  device_id,
  ip,
  COUNT(*) AS total_calls,
  AVG(latency_ms) AS avg_latency_ms,
  COUNT(*) FILTER (WHERE status = 'error') AS error_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cache_hit = true) / NULLIF(COUNT(*), 0), 2) AS cache_hit_rate,
  COUNT(*) FILTER (WHERE status = 'rate_limited') AS rate_limit_hits
FROM scan_telemetry_events
WHERE event_type = 'scan'
GROUP BY 1, 2, 3, 4;
