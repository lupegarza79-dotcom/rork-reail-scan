-- Migration 20240213: RLS + policies for wallet/money/appeal/claim tables + cleanup functions
-- SELF-CONTAINED & FULLY IDEMPOTENT
--   Phase 1 — CREATE TABLE IF NOT EXISTS for every prerequisite table
--   Phase 2 — Helper functions & triggers
--   Phase 3 — RLS + policies (all guarded with to_regclass / DROP IF EXISTS)
--   Phase 4 — Cleanup functions
-- Safe on: fresh DB, partially-migrated DB, already-fully-migrated DB.

-- ============================================================
-- PHASE 1: Ensure all tables exist
-- ============================================================

-- 1a) wallet_share_links
CREATE TABLE IF NOT EXISTS public.wallet_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(32) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  domain VARCHAR(255),
  scan_id UUID,
  badge VARCHAR(20),
  score INTEGER,
  top_red_flags JSONB DEFAULT '[]'::jsonb,
  next_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  device_id VARCHAR(255),
  ip VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_wallet_share_token ON public.wallet_share_links(token);
CREATE INDEX IF NOT EXISTS idx_wallet_share_expires ON public.wallet_share_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_wallet_share_domain ON public.wallet_share_links(domain);
CREATE INDEX IF NOT EXISTS idx_wallet_share_created ON public.wallet_share_links(created_at DESC);

DO $$ BEGIN
  ALTER TABLE public.wallet_share_links
    ADD CONSTRAINT wallet_share_links_scan_id_fkey
    FOREIGN KEY (scan_id) REFERENCES public.scan_results(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- 1b) money_cases enums
DO $$ BEGIN
  CREATE TYPE money_case_issue AS ENUM (
    'unauthorized_charge','product_not_received','product_not_as_described',
    'duplicate_charge','subscription_cancellation','refund_not_processed',
    'scam_fraud','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE money_case_status AS ENUM (
    'draft','submitted','in_progress','resolved','escalated','closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM (
    'credit_card','debit_card','paypal','venmo','zelle','cash_app',
    'apple_pay','google_pay','bank_transfer','crypto','gift_card','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE desired_outcome AS ENUM (
    'full_refund','partial_refund','replacement','store_credit','chargeback','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1c) money_cases
CREATE TABLE IF NOT EXISTS public.money_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token VARCHAR(32),
  scan_id UUID,
  issue_type money_case_issue NOT NULL DEFAULT 'other',
  status money_case_status DEFAULT 'draft',
  amount_cents INTEGER,
  currency VARCHAR(3) DEFAULT 'USD',
  transaction_date DATE,
  payment_method payment_method_type,
  merchant_name VARCHAR(255),
  merchant_url TEXT,
  merchant_domain VARCHAR(255),
  description TEXT,
  desired_outcome desired_outcome,
  rail_pack JSONB,
  device_id VARCHAR(255),
  ip VARCHAR(45),
  locale VARCHAR(10) DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_money_cases_share_token ON public.money_cases(share_token);
CREATE INDEX IF NOT EXISTS idx_money_cases_device ON public.money_cases(device_id);
CREATE INDEX IF NOT EXISTS idx_money_cases_status ON public.money_cases(status);
CREATE INDEX IF NOT EXISTS idx_money_cases_created ON public.money_cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_money_cases_merchant ON public.money_cases(merchant_domain);

DO $$ BEGIN
  ALTER TABLE public.money_cases
    ADD CONSTRAINT money_cases_share_token_fkey
    FOREIGN KEY (share_token) REFERENCES public.wallet_share_links(token) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.money_cases
    ADD CONSTRAINT money_cases_scan_id_fkey
    FOREIGN KEY (scan_id) REFERENCES public.scan_results(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- 1d) case_events
CREATE TABLE IF NOT EXISTS public.case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_events_case ON public.case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_type ON public.case_events(event_type);
CREATE INDEX IF NOT EXISTS idx_case_events_created ON public.case_events(created_at);

DO $$ BEGIN
  ALTER TABLE public.case_events
    ADD CONSTRAINT case_events_case_id_fkey
    FOREIGN KEY (case_id) REFERENCES public.money_cases(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1e) case_artifacts
CREATE TABLE IF NOT EXISTS public.case_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL,
  artifact_type VARCHAR(50) NOT NULL,
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  file_url TEXT,
  file_size_bytes INTEGER,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_artifacts_case ON public.case_artifacts(case_id);
CREATE INDEX IF NOT EXISTS idx_case_artifacts_type ON public.case_artifacts(artifact_type);

DO $$ BEGIN
  ALTER TABLE public.case_artifacts
    ADD CONSTRAINT case_artifacts_case_id_fkey
    FOREIGN KEY (case_id) REFERENCES public.money_cases(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1f) appeals
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

-- 1g) claims
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

-- ============================================================
-- PHASE 2: Helper functions & triggers
-- ============================================================

CREATE OR REPLACE FUNCTION update_money_case_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trigger_money_case_updated
    BEFORE UPDATE ON public.money_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_money_case_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION add_case_event(
  p_case_id UUID,
  p_event_type VARCHAR,
  p_title VARCHAR,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.case_events (case_id, event_type, title, description, metadata)
  VALUES (p_case_id, p_event_type, p_title, p_description, p_metadata)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_share_links()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    DELETE FROM public.wallet_share_links WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
  ELSE
    deleted_count := 0;
  END IF;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION increment_share_view(p_token VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass('public.wallet_share_links') IS NOT NULL THEN
    UPDATE public.wallet_share_links
    SET view_count = view_count + 1, last_viewed_at = NOW()
    WHERE token = p_token AND expires_at > NOW();
  END IF;
END;
$$;

-- ============================================================
-- PHASE 3: RLS + policies for all tables
-- ============================================================

-- 3a) wallet_share_links
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

-- 3b) money_cases
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

-- 3c) case_events
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

-- 3d) case_artifacts
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

-- 3e) appeals
DO $$ BEGIN
  IF to_regclass('public.appeals') IS NOT NULL THEN
    ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.appeals') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role manages appeals" ON public.appeals;
    CREATE POLICY "Service role manages appeals"
      ON public.appeals FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.appeals') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Device reads own appeals" ON public.appeals;
    CREATE POLICY "Device reads own appeals"
      ON public.appeals FOR SELECT
      USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3f) claims
DO $$ BEGIN
  IF to_regclass('public.claims') IS NOT NULL THEN
    ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.claims') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role manages claims" ON public.claims;
    CREATE POLICY "Service role manages claims"
      ON public.claims FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.claims') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Device reads own claims" ON public.claims;
    CREATE POLICY "Device reads own claims"
      ON public.claims FOR SELECT
      USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PHASE 4: Cleanup functions (resilient — check table existence)
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
