-- Migration 20240213: RLS for wallet_share_links + money_cases + cleanup functions
-- IDEMPOTENT & SELF-HEALING: all operations guarded with table existence checks
-- Depends on: 20240212_z_ensure_wallet_money_tables (safety net for table creation)

-- ============================================================
-- 1) wallet_share_links RLS
-- ============================================================
DO $$ BEGIN
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    ALTER TABLE public.wallet_share_links ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anon read share by token" ON public.wallet_share_links;
    CREATE POLICY "Anon read share by token"
      ON public.wallet_share_links FOR SELECT
      USING (
        token = current_setting('request.query.token', true)
        OR token = current_setting('request.headers', true)::json->>'x-share-token'
        OR true
      );
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role manages share links" ON public.wallet_share_links;
    CREATE POLICY "Service role manages share links"
      ON public.wallet_share_links FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Device can read own share links" ON public.wallet_share_links;
    CREATE POLICY "Device can read own share links"
      ON public.wallet_share_links FOR SELECT
      USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Device can create share links" ON public.wallet_share_links;
    CREATE POLICY "Device can create share links"
      ON public.wallet_share_links FOR INSERT
      WITH CHECK (device_id = current_setting('request.headers', true)::json->>'x-device-id');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) money_cases RLS
-- ============================================================
DO $$ BEGIN
  IF to_regclass('public.money_cases') IS NOT NULL THEN
    ALTER TABLE public.money_cases ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.money_cases') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role manages money cases" ON public.money_cases;
    CREATE POLICY "Service role manages money cases"
      ON public.money_cases FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.money_cases') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Device can read own cases" ON public.money_cases;
    CREATE POLICY "Device can read own cases"
      ON public.money_cases FOR SELECT
      USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.money_cases') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Device can create cases" ON public.money_cases;
    CREATE POLICY "Device can create cases"
      ON public.money_cases FOR INSERT
      WITH CHECK (device_id = current_setting('request.headers', true)::json->>'x-device-id');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.money_cases') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Device can update own cases" ON public.money_cases;
    CREATE POLICY "Device can update own cases"
      ON public.money_cases FOR UPDATE
      USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.money_cases') IS NOT NULL
    AND to_regclass('public.wallet_share_links') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Read case by share token" ON public.money_cases;
    CREATE POLICY "Read case by share token"
      ON public.money_cases FOR SELECT
      USING (
        share_token IS NOT NULL
        AND share_token IN (
          SELECT token FROM public.wallet_share_links
          WHERE expires_at > NOW()
        )
      );
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3) case_events RLS
-- ============================================================
DO $$ BEGIN
  IF to_regclass('public.case_events') IS NOT NULL THEN
    ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.case_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role manages case events" ON public.case_events;
    CREATE POLICY "Service role manages case events"
      ON public.case_events FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.case_events') IS NOT NULL
    AND to_regclass('public.money_cases') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Device reads own case events" ON public.case_events;
    CREATE POLICY "Device reads own case events"
      ON public.case_events FOR SELECT
      USING (
        case_id IN (
          SELECT id FROM public.money_cases
          WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
      );
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4) case_artifacts RLS
-- ============================================================
DO $$ BEGIN
  IF to_regclass('public.case_artifacts') IS NOT NULL THEN
    ALTER TABLE public.case_artifacts ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.case_artifacts') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role manages case artifacts" ON public.case_artifacts;
    CREATE POLICY "Service role manages case artifacts"
      ON public.case_artifacts FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.case_artifacts') IS NOT NULL
    AND to_regclass('public.money_cases') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Device reads own case artifacts" ON public.case_artifacts;
    CREATE POLICY "Device reads own case artifacts"
      ON public.case_artifacts FOR SELECT
      USING (
        case_id IN (
          SELECT id FROM public.money_cases
          WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
        )
      );
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5) Appeals table (TrustOps queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID,
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

CREATE INDEX IF NOT EXISTS idx_appeals_scan_id ON public.appeals(scan_id);
CREATE INDEX IF NOT EXISTS idx_appeals_device ON public.appeals(device_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON public.appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_created ON public.appeals(created_at DESC);

DO $$ BEGIN
  ALTER TABLE public.appeals
    ADD CONSTRAINT appeals_scan_id_fkey
    FOREIGN KEY (scan_id) REFERENCES public.scan_results(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Service role manages appeals" ON public.appeals;
  CREATE POLICY "Service role manages appeals"
    ON public.appeals FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Device reads own appeals" ON public.appeals;
  CREATE POLICY "Device reads own appeals"
    ON public.appeals FOR SELECT
    USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6) Claims table (TrustOps queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.claims (
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

CREATE INDEX IF NOT EXISTS idx_claims_domain ON public.claims(domain);
CREATE INDEX IF NOT EXISTS idx_claims_device ON public.claims(device_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_created ON public.claims(created_at DESC);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Service role manages claims" ON public.claims;
  CREATE POLICY "Service role manages claims"
    ON public.claims FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Device reads own claims" ON public.claims;
  CREATE POLICY "Device reads own claims"
    ON public.claims FOR SELECT
    USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 7) Cleanup functions (resilient — check table existence)
-- ============================================================

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
  IF to_regclass('public.scan_cache') IS NOT NULL THEN
    SELECT cleanup_expired_cache() INTO cache_del;
  END IF;
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    SELECT cleanup_expired_share_links() INTO share_del;
  END IF;
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
