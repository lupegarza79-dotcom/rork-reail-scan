-- Production hardening (fix-forward, idempotent)
-- - Align telemetry schema across legacy/current deployments
-- - Rebuild telemetry_summary safely when older column names exist
-- - Add optional share-token access fields for scan-result

ALTER TABLE IF EXISTS public.scan_telemetry_events
  ADD COLUMN IF NOT EXISTS endpoint text;

ALTER TABLE IF EXISTS public.scan_telemetry_events
  ADD COLUMN IF NOT EXISTS status text;

-- Backfill endpoint/status from legacy columns when needed.
UPDATE public.scan_telemetry_events
SET endpoint = COALESCE(endpoint, function_name, 'unknown')
WHERE endpoint IS NULL;

UPDATE public.scan_telemetry_events
SET status = COALESCE(
  status,
  CASE
    WHEN success IS FALSE THEN 'error'
    WHEN success IS TRUE THEN 'ok'
    ELSE 'unknown'
  END
)
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_scan_telemetry_events_endpoint
  ON public.scan_telemetry_events(endpoint);

-- IMPORTANT: do not CREATE OR REPLACE VIEW here because postgres cannot rename
-- existing view output columns in-place (function_name -> endpoint).
DROP VIEW IF EXISTS public.telemetry_summary;

CREATE VIEW public.telemetry_summary AS
SELECT
  date_trunc('day', created_at) AS bucket,
  COALESCE(endpoint, function_name, 'unknown') AS endpoint,
  device_id,
  ip,
  COUNT(*) FILTER (WHERE event_type = 'scan') AS total_calls,
  AVG(latency_ms) FILTER (WHERE event_type = 'scan') AS avg_latency_ms,
  COUNT(*) FILTER (WHERE event_type = 'scan' AND COALESCE(status, CASE WHEN success IS FALSE THEN 'error' ELSE 'ok' END) = 'error') AS error_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'scan' AND cache_hit = true)
    / NULLIF(COUNT(*) FILTER (WHERE event_type = 'scan'), 0),
    2
  ) AS cache_hit_rate,
  COUNT(*) FILTER (WHERE event_type = 'scan' AND COALESCE(status, '') = 'rate_limited') AS rate_limit_hits
FROM public.scan_telemetry_events
GROUP BY 1, 2, 3, 4;

ALTER TABLE IF EXISTS public.scan_results
  ADD COLUMN IF NOT EXISTS share_token text;

ALTER TABLE IF EXISTS public.scan_results
  ADD COLUMN IF NOT EXISTS share_token_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_scan_results_share_token
  ON public.scan_results(share_token)
  WHERE share_token IS NOT NULL;
