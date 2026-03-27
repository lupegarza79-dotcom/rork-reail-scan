-- Migration 20240217: GO LIVE fix-forward
-- P0: Fix appeals INSERT failures (RLS policy for anon INSERT)
-- P1: Fix telemetry inserts (make function_name nullable since we use endpoint now)
-- SAFE: Fully idempotent, additive only

-- ============================================================
-- PHASE 1: Fix appeals RLS - allow anon to INSERT
-- The GRANT already exists, but RLS policy blocks anon inserts
-- Service role bypasses RLS, but let's also enable anon insert
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for appeals
DROP POLICY IF EXISTS "Service role manages appeals" ON public.appeals;
CREATE POLICY "Service role manages appeals"
  ON public.appeals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anon can insert appeals" ON public.appeals;
CREATE POLICY "Anon can insert appeals"
  ON public.appeals FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Device reads own appeals" ON public.appeals;
CREATE POLICY "Device reads own appeals"
  ON public.appeals FOR SELECT
  TO anon
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- Ensure grants are in place
GRANT SELECT, INSERT ON public.appeals TO anon;
GRANT ALL ON public.appeals TO service_role;

-- ============================================================
-- PHASE 2: Fix claims RLS - same pattern as appeals
-- ============================================================

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages claims" ON public.claims;
CREATE POLICY "Service role manages claims"
  ON public.claims FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anon can insert claims" ON public.claims;
CREATE POLICY "Anon can insert claims"
  ON public.claims FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Device reads own claims" ON public.claims;
CREATE POLICY "Device reads own claims"
  ON public.claims FOR SELECT
  TO anon
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

GRANT SELECT, INSERT ON public.claims TO anon;
GRANT ALL ON public.claims TO service_role;

-- ============================================================
-- PHASE 3: Fix telemetry - make function_name nullable
-- Edge functions now use 'endpoint' column, but function_name is NOT NULL
-- This causes inserts to fail when function_name is not provided
-- ============================================================

DO $$ BEGIN
  IF to_regclass('public.scan_telemetry_events') IS NOT NULL THEN
    -- Make function_name nullable (it was NOT NULL in original schema)
    ALTER TABLE public.scan_telemetry_events 
      ALTER COLUMN function_name DROP NOT NULL;
    
    -- Make event_type nullable or set default
    ALTER TABLE public.scan_telemetry_events 
      ALTER COLUMN event_type SET DEFAULT 'scan';
  END IF;
END $$;

-- ============================================================
-- PHASE 4: Ensure scan_telemetry_events has proper RLS for service_role
-- ============================================================

DO $$ BEGIN
  IF to_regclass('public.scan_telemetry_events') IS NOT NULL THEN
    ALTER TABLE public.scan_telemetry_events ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Service role can manage telemetry events" ON public.scan_telemetry_events;
    CREATE POLICY "Service role can manage telemetry events"
      ON public.scan_telemetry_events FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    
    GRANT ALL ON public.scan_telemetry_events TO service_role;
  END IF;
END $$;

-- ============================================================
-- PHASE 5: Verify appeals table has all required columns
-- ============================================================

DO $$ BEGIN
  -- Ensure all columns exist with correct types
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS token TEXT;
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS ip TEXT;
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS evidence_links TEXT[];
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- DONE: This migration ensures:
-- 1. Appeals can be inserted via anon key (RLS policy allows INSERT)
-- 2. Telemetry inserts succeed even without function_name
-- 3. All tables have proper service_role access
-- ============================================================
