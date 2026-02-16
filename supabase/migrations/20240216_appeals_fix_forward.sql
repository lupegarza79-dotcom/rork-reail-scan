-- Fix-forward migration for appeals table
-- Ensures the appeals table exists with all required columns and proper RLS

-- 1) Create appeals table if not exists (idempotent)
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

-- 2) Add missing columns if they don't exist (idempotent)
DO $$ BEGIN
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS token TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS ip TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS evidence_links TEXT[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3) Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_appeals_scan_id ON public.appeals(scan_id);
CREATE INDEX IF NOT EXISTS idx_appeals_device ON public.appeals(device_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON public.appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_created ON public.appeals(created_at DESC);

-- 4) Add FK constraint if not exists (allow scan_id to be NULL for appeals without scan)
DO $$ BEGIN
  ALTER TABLE public.appeals
    ADD CONSTRAINT appeals_scan_id_fkey
    FOREIGN KEY (scan_id) REFERENCES public.scan_results(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- 5) Enable RLS
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

-- 6) Drop and recreate policies (idempotent)
DROP POLICY IF EXISTS "Service role manages appeals" ON public.appeals;
CREATE POLICY "Service role manages appeals"
  ON public.appeals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Device reads own appeals" ON public.appeals;
CREATE POLICY "Device reads own appeals"
  ON public.appeals FOR SELECT
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- 7) Grant permissions
GRANT SELECT, INSERT ON public.appeals TO anon;
GRANT ALL ON public.appeals TO service_role;
