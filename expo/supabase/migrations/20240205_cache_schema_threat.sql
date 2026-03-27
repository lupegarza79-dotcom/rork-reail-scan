-- Migration: scan_cache table + schema alignment for card_* columns + new providers

-- 1) Add scan_cache table
CREATE TABLE IF NOT EXISTS scan_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_cache_expires ON scan_cache(expires_at);

-- 2) Add new evidence provider values
DO $$ BEGIN
  ALTER TYPE evidence_provider ADD VALUE IF NOT EXISTS 'ssl_intel';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE evidence_provider ADD VALUE IF NOT EXISTS 'google_safe_browsing';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE evidence_provider ADD VALUE IF NOT EXISTS 'virustotal';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE evidence_provider ADD VALUE IF NOT EXISTS 'reputation_reports';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3) Add 'unknown' to evidence_status
DO $$ BEGIN
  ALTER TYPE evidence_status ADD VALUE IF NOT EXISTS 'unknown';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) Add card_* columns to scan_evidence (keep old columns for backward compat)
ALTER TABLE scan_evidence ADD COLUMN IF NOT EXISTS card_title TEXT;
ALTER TABLE scan_evidence ADD COLUMN IF NOT EXISTS card_status TEXT;
ALTER TABLE scan_evidence ADD COLUMN IF NOT EXISTS card_payload JSONB;

-- Make old required columns nullable so inserts with card_* work
ALTER TABLE scan_evidence ALTER COLUMN provider_label DROP NOT NULL;
ALTER TABLE scan_evidence ALTER COLUMN summary DROP NOT NULL;
ALTER TABLE scan_evidence ALTER COLUMN status DROP NOT NULL;

-- 5) RLS for scan_cache (service role only)
ALTER TABLE scan_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage cache" ON scan_cache;
CREATE POLICY "Service role can manage cache"
  ON scan_cache FOR ALL
  USING (auth.role() = 'service_role');

-- 6) Helper: cleanup expired cache (can be called via pg_cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM scan_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
