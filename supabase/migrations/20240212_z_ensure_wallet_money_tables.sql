-- Migration 20240212z: Ensure wallet_share_links + money_cases tables exist
-- Safety net for environments where earlier migrations (20240209, 20240210)
-- did not fully apply or tables were dropped.
-- Sorts after 20240212_trust_graph, before 20240213_rls_wallet_money_cleanup.
-- IDEMPOTENT: all operations use IF NOT EXISTS or EXCEPTION guards.

-- ============================================================
-- 1) wallet_share_links (originally from 20240209)
-- ============================================================
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

CREATE OR REPLACE FUNCTION cleanup_expired_share_links()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.wallet_share_links WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION increment_share_view(p_token VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.wallet_share_links
  SET view_count = view_count + 1, last_viewed_at = NOW()
  WHERE token = p_token AND expires_at > NOW();
END;
$$;

-- ============================================================
-- 2) money_cases enums (originally from 20240210)
-- ============================================================
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

-- ============================================================
-- 3) money_cases (originally from 20240210)
-- ============================================================
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

-- ============================================================
-- 4) case_events (originally from 20240210)
-- ============================================================
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

-- ============================================================
-- 5) case_artifacts (originally from 20240210)
-- ============================================================
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

-- ============================================================
-- 6) money_cases helper functions + trigger
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
