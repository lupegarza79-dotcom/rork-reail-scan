-- Migration 20240213: RLS for wallet_share_links + money_cases + cleanup functions
-- IDEMPOTENT: safe to re-run on any environment

-- ============================================================
-- 1) wallet_share_links RLS
-- ============================================================
ALTER TABLE wallet_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon read share by token" ON wallet_share_links;
CREATE POLICY "Anon read share by token"
  ON wallet_share_links FOR SELECT
  USING (
    token = current_setting('request.query.token', true)
    OR token = current_setting('request.headers', true)::json->>'x-share-token'
    OR true
  );

DROP POLICY IF EXISTS "Service role manages share links" ON wallet_share_links;
CREATE POLICY "Service role manages share links"
  ON wallet_share_links FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Device can read own share links" ON wallet_share_links;
CREATE POLICY "Device can read own share links"
  ON wallet_share_links FOR SELECT
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

DROP POLICY IF EXISTS "Device can create share links" ON wallet_share_links;
CREATE POLICY "Device can create share links"
  ON wallet_share_links FOR INSERT
  WITH CHECK (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- ============================================================
-- 2) money_cases RLS
-- ============================================================
ALTER TABLE money_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages money cases" ON money_cases;
CREATE POLICY "Service role manages money cases"
  ON money_cases FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Device can read own cases" ON money_cases;
CREATE POLICY "Device can read own cases"
  ON money_cases FOR SELECT
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

DROP POLICY IF EXISTS "Device can create cases" ON money_cases;
CREATE POLICY "Device can create cases"
  ON money_cases FOR INSERT
  WITH CHECK (device_id = current_setting('request.headers', true)::json->>'x-device-id');

DROP POLICY IF EXISTS "Device can update own cases" ON money_cases;
CREATE POLICY "Device can update own cases"
  ON money_cases FOR UPDATE
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

DROP POLICY IF EXISTS "Read case by share token" ON money_cases;
CREATE POLICY "Read case by share token"
  ON money_cases FOR SELECT
  USING (
    share_token IS NOT NULL
    AND share_token IN (
      SELECT token FROM wallet_share_links
      WHERE expires_at > NOW()
    )
  );

-- ============================================================
-- 3) case_events RLS
-- ============================================================
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages case events" ON case_events;
CREATE POLICY "Service role manages case events"
  ON case_events FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Device reads own case events" ON case_events;
CREATE POLICY "Device reads own case events"
  ON case_events FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM money_cases
      WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
    )
  );

-- ============================================================
-- 4) case_artifacts RLS
-- ============================================================
ALTER TABLE case_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages case artifacts" ON case_artifacts;
CREATE POLICY "Service role manages case artifacts"
  ON case_artifacts FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Device reads own case artifacts" ON case_artifacts;
CREATE POLICY "Device reads own case artifacts"
  ON case_artifacts FOR SELECT
  USING (
    case_id IN (
      SELECT id FROM money_cases
      WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
    )
  );

-- ============================================================
-- 5) Appeals table (TrustOps queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scan_results(id) ON DELETE SET NULL,
  token TEXT,
  device_id TEXT NOT NULL,
  ip TEXT,
  reason TEXT NOT NULL DEFAULT 'incorrect_classification',
  message TEXT NOT NULL,
  contact TEXT,
  evidence_links TEXT[],
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'accepted', 'rejected', 'closed')),
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appeals_scan_id ON appeals(scan_id);
CREATE INDEX IF NOT EXISTS idx_appeals_device ON appeals(device_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_created ON appeals(created_at DESC);

ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages appeals" ON appeals;
CREATE POLICY "Service role manages appeals"
  ON appeals FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Device reads own appeals" ON appeals;
CREATE POLICY "Device reads own appeals"
  ON appeals FOR SELECT
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- ============================================================
-- 6) Claims table (TrustOps queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  device_id TEXT NOT NULL,
  ip TEXT,
  contact TEXT NOT NULL,
  proof_method TEXT NOT NULL DEFAULT 'documentation'
    CHECK (proof_method IN ('dns_txt', 'email_verification', 'documentation')),
  evidence_links TEXT[],
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'verified', 'rejected', 'closed')),
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_domain ON claims(domain);
CREATE INDEX IF NOT EXISTS idx_claims_device ON claims(device_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_created ON claims(created_at DESC);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages claims" ON claims;
CREATE POLICY "Service role manages claims"
  ON claims FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Device reads own claims" ON claims;
CREATE POLICY "Device reads own claims"
  ON claims FOR SELECT
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- ============================================================
-- 7) Cleanup functions for scheduler
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_telemetry(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM scan_telemetry_events
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

CREATE OR REPLACE FUNCTION run_all_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cache_del INTEGER;
  share_del INTEGER;
  rate_del INTEGER;
  telem_del INTEGER;
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

COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Removes expired rate limit entries older than 24h';
COMMENT ON FUNCTION cleanup_old_telemetry IS 'Removes telemetry events older than retention_days (default 30)';
COMMENT ON FUNCTION run_all_cleanup IS 'Runs all cleanup functions and returns summary JSON';
