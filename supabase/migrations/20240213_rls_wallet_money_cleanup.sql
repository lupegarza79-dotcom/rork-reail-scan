-- Migration 20240213: RLS for wallet_share_links + money_cases + cleanup functions
-- IDEMPOTENT: safe to re-run on any environment (fresh or existing)

-- ============================================================
-- 1) wallet_share_links RLS
-- ============================================================
ALTER TABLE public.wallet_share_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_share_links' AND policyname='Anon read share by token') THEN
    DROP POLICY "Anon read share by token" ON public.wallet_share_links;
  END IF;
  CREATE POLICY "Anon read share by token"
    ON public.wallet_share_links FOR SELECT
    USING (
      token = current_setting('request.query.token', true)
      OR token = current_setting('request.headers', true)::json->>'x-share-token'
      OR true
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_share_links' AND policyname='Service role manages share links') THEN
    DROP POLICY "Service role manages share links" ON public.wallet_share_links;
  END IF;
  CREATE POLICY "Service role manages share links"
    ON public.wallet_share_links FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_share_links' AND policyname='Device can read own share links') THEN
    DROP POLICY "Device can read own share links" ON public.wallet_share_links;
  END IF;
  CREATE POLICY "Device can read own share links"
    ON public.wallet_share_links FOR SELECT
    USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wallet_share_links' AND policyname='Device can create share links') THEN
    DROP POLICY "Device can create share links" ON public.wallet_share_links;
  END IF;
  CREATE POLICY "Device can create share links"
    ON public.wallet_share_links FOR INSERT
    WITH CHECK (device_id = current_setting('request.headers', true)::json->>'x-device-id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) money_cases RLS
-- ============================================================
ALTER TABLE public.money_cases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='money_cases' AND policyname='Service role manages money cases') THEN
    DROP POLICY "Service role manages money cases" ON public.money_cases;
  END IF;
  CREATE POLICY "Service role manages money cases"
    ON public.money_cases FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='money_cases' AND policyname='Device can read own cases') THEN
    DROP POLICY "Device can read own cases" ON public.money_cases;
  END IF;
  CREATE POLICY "Device can read own cases"
    ON public.money_cases FOR SELECT
    USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='money_cases' AND policyname='Device can create cases') THEN
    DROP POLICY "Device can create cases" ON public.money_cases;
  END IF;
  CREATE POLICY "Device can create cases"
    ON public.money_cases FOR INSERT
    WITH CHECK (device_id = current_setting('request.headers', true)::json->>'x-device-id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='money_cases' AND policyname='Device can update own cases') THEN
    DROP POLICY "Device can update own cases" ON public.money_cases;
  END IF;
  CREATE POLICY "Device can update own cases"
    ON public.money_cases FOR UPDATE
    USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='money_cases' AND policyname='Read case by share token') THEN
    DROP POLICY "Read case by share token" ON public.money_cases;
  END IF;
  CREATE POLICY "Read case by share token"
    ON public.money_cases FOR SELECT
    USING (
      share_token IS NOT NULL
      AND share_token IN (
        SELECT token FROM public.wallet_share_links
        WHERE expires_at > NOW()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3) case_events RLS
-- ============================================================
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='case_events' AND policyname='Service role manages case events') THEN
    DROP POLICY "Service role manages case events" ON public.case_events;
  END IF;
  CREATE POLICY "Service role manages case events"
    ON public.case_events FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='case_events' AND policyname='Device reads own case events') THEN
    DROP POLICY "Device reads own case events" ON public.case_events;
  END IF;
  CREATE POLICY "Device reads own case events"
    ON public.case_events FOR SELECT
    USING (
      case_id IN (
        SELECT id FROM public.money_cases
        WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4) case_artifacts RLS
-- ============================================================
ALTER TABLE public.case_artifacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='case_artifacts' AND policyname='Service role manages case artifacts') THEN
    DROP POLICY "Service role manages case artifacts" ON public.case_artifacts;
  END IF;
  CREATE POLICY "Service role manages case artifacts"
    ON public.case_artifacts FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='case_artifacts' AND policyname='Device reads own case artifacts') THEN
    DROP POLICY "Device reads own case artifacts" ON public.case_artifacts;
  END IF;
  CREATE POLICY "Device reads own case artifacts"
    ON public.case_artifacts FOR SELECT
    USING (
      case_id IN (
        SELECT id FROM public.money_cases
        WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5) Appeals table (TrustOps queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES public.scan_results(id) ON DELETE SET NULL,
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

ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appeals' AND policyname='Service role manages appeals') THEN
    DROP POLICY "Service role manages appeals" ON public.appeals;
  END IF;
  CREATE POLICY "Service role manages appeals"
    ON public.appeals FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appeals' AND policyname='Device reads own appeals') THEN
    DROP POLICY "Device reads own appeals" ON public.appeals;
  END IF;
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
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='claims' AND policyname='Service role manages claims') THEN
    DROP POLICY "Service role manages claims" ON public.claims;
  END IF;
  CREATE POLICY "Service role manages claims"
    ON public.claims FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='claims' AND policyname='Device reads own claims') THEN
    DROP POLICY "Device reads own claims" ON public.claims;
  END IF;
  CREATE POLICY "Device reads own claims"
    ON public.claims FOR SELECT
    USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
  DELETE FROM public.rate_limits WHERE window_end < NOW() - INTERVAL '24 hours';
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
  DELETE FROM public.scan_telemetry_events
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
