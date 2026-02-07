-- Migration: rate limits + telemetry events

-- 1) Rate limits table (service role only)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end ON rate_limits(window_end);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rate limits"
  ON rate_limits FOR ALL
  USING (auth.role() = 'service_role');

-- 2) Telemetry events table (service role only)
CREATE TABLE IF NOT EXISTS scan_telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  function_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  device_id TEXT,
  ip TEXT,
  cache_hit BOOLEAN,
  provider TEXT,
  latency_ms INTEGER,
  success BOOLEAN,
  error_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_scan_telemetry_events_created_at ON scan_telemetry_events(created_at);
CREATE INDEX IF NOT EXISTS idx_scan_telemetry_events_function ON scan_telemetry_events(function_name);
CREATE INDEX IF NOT EXISTS idx_scan_telemetry_events_provider ON scan_telemetry_events(provider);

ALTER TABLE scan_telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage telemetry events"
  ON scan_telemetry_events FOR ALL
  USING (auth.role() = 'service_role');

-- 3) Telemetry summary view
CREATE OR REPLACE VIEW telemetry_summary AS
SELECT
  date_trunc('hour', created_at) AS bucket,
  function_name,
  COUNT(*) FILTER (WHERE event_type = 'scan') AS scan_count,
  COUNT(*) FILTER (WHERE event_type = 'scan' AND cache_hit = true) AS cache_hit_count,
  AVG(latency_ms) FILTER (WHERE event_type = 'provider') AS avg_provider_latency_ms,
  COUNT(*) FILTER (WHERE event_type = 'provider' AND success = false) AS provider_error_count
FROM scan_telemetry_events
GROUP BY 1, 2;
