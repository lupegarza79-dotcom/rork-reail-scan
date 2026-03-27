-- Migration 20240214: TrustOps tables for audit runs, outcomes, and notifications
-- FULLY IDEMPOTENT: safe to re-run on any environment (fresh or existing)
-- All ALTER TABLE ENABLE RLS wrapped in existence checks
-- All FKs in guarded DO $$ blocks
-- All policies: check pg_policies, drop if exists, then create

-- ============================================================
-- 1) trustops_audit_runs — tracks automated and manual audit passes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trustops_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL DEFAULT 'automated'
    CHECK (run_type IN ('automated', 'manual', 'appeal_triggered', 'claim_triggered')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  trigger_id UUID,
  trigger_type TEXT
    CHECK (trigger_type IS NULL OR trigger_type IN ('appeal', 'claim', 'scan', 'schedule')),
  domain TEXT,
  scan_id UUID,
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trustops_audit_runs_status ON public.trustops_audit_runs(status);
CREATE INDEX IF NOT EXISTS idx_trustops_audit_runs_domain ON public.trustops_audit_runs(domain);
CREATE INDEX IF NOT EXISTS idx_trustops_audit_runs_trigger ON public.trustops_audit_runs(trigger_type, trigger_id);
CREATE INDEX IF NOT EXISTS idx_trustops_audit_runs_created ON public.trustops_audit_runs(created_at DESC);

DO $$ BEGIN
  ALTER TABLE public.trustops_audit_runs
    ADD CONSTRAINT trustops_audit_runs_scan_id_fkey
    FOREIGN KEY (scan_id) REFERENCES public.scan_results(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.trustops_audit_runs') IS NOT NULL THEN
    ALTER TABLE public.trustops_audit_runs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.trustops_audit_runs') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trustops_audit_runs' AND policyname='Service role manages audit runs') THEN
      DROP POLICY "Service role manages audit runs" ON public.trustops_audit_runs;
    END IF;
    CREATE POLICY "Service role manages audit runs"
      ON public.trustops_audit_runs FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2) trustops_outcomes — resolution records for appeals/claims
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trustops_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('appeal', 'claim', 'scan', 'domain')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('accepted', 'rejected', 'escalated', 'badge_updated', 'tier_updated', 'no_action')),
  previous_value JSONB DEFAULT '{}'::jsonb,
  new_value JSONB DEFAULT '{}'::jsonb,
  reason TEXT,
  resolved_by TEXT NOT NULL DEFAULT 'system',
  audit_run_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trustops_outcomes_entity ON public.trustops_outcomes(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_trustops_outcomes_action ON public.trustops_outcomes(action);
CREATE INDEX IF NOT EXISTS idx_trustops_outcomes_created ON public.trustops_outcomes(created_at DESC);

DO $$ BEGIN
  ALTER TABLE public.trustops_outcomes
    ADD CONSTRAINT trustops_outcomes_audit_run_id_fkey
    FOREIGN KEY (audit_run_id) REFERENCES public.trustops_audit_runs(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.trustops_outcomes') IS NOT NULL THEN
    ALTER TABLE public.trustops_outcomes ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.trustops_outcomes') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trustops_outcomes' AND policyname='Service role manages outcomes') THEN
      DROP POLICY "Service role manages outcomes" ON public.trustops_outcomes;
    END IF;
    CREATE POLICY "Service role manages outcomes"
      ON public.trustops_outcomes FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3) trustops_notifications — outbound notifications log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trustops_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'sms', 'push', 'webhook')),
  recipient_type TEXT NOT NULL DEFAULT 'device'
    CHECK (recipient_type IN ('device', 'email', 'webhook')),
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  error_message TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trustops_notifications_recipient ON public.trustops_notifications(recipient_type, recipient);
CREATE INDEX IF NOT EXISTS idx_trustops_notifications_status ON public.trustops_notifications(status);
CREATE INDEX IF NOT EXISTS idx_trustops_notifications_related ON public.trustops_notifications(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_trustops_notifications_created ON public.trustops_notifications(created_at DESC);

DO $$ BEGIN
  IF to_regclass('public.trustops_notifications') IS NOT NULL THEN
    ALTER TABLE public.trustops_notifications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.trustops_notifications') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trustops_notifications' AND policyname='Service role manages notifications') THEN
      DROP POLICY "Service role manages notifications" ON public.trustops_notifications;
    END IF;
    CREATE POLICY "Service role manages notifications"
      ON public.trustops_notifications FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.trustops_notifications') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trustops_notifications' AND policyname='Device reads own notifications') THEN
      DROP POLICY "Device reads own notifications" ON public.trustops_notifications;
    END IF;
    CREATE POLICY "Device reads own notifications"
      ON public.trustops_notifications FOR SELECT
      USING (
        recipient_type = 'device'
        AND recipient = current_setting('request.headers', true)::json->>'x-device-id'
      );
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
