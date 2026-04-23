-- Migration: wallet-share evidence hardening
-- Ensures wallet-share always returns evidence-backed badge/score/next_action
-- IDEMPOTENT: safe to run against existing DB

-- 1) Add normalized_url column to scan_results for canonical cache alignment
ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS normalized_url TEXT;

CREATE INDEX IF NOT EXISTS idx_scan_results_normalized_url
  ON scan_results(normalized_url);

-- 2) Ensure wallet_share_links has normalized_url for cache correlation
ALTER TABLE wallet_share_links ADD COLUMN IF NOT EXISTS normalized_url TEXT;

CREATE INDEX IF NOT EXISTS idx_wallet_share_normalized_url
  ON wallet_share_links(normalized_url);

-- 3) Backfill NOT NULL safety defaults on wallet_share_links
-- We intentionally keep columns nullable at schema level because legacy rows
-- may predate this migration, but we enforce non-null at write-time in code.
-- Backfill any legacy rows missing next_action with a safe default.
UPDATE wallet_share_links
SET next_action = 'Review carefully before paying.'
WHERE next_action IS NULL;

UPDATE wallet_share_links
SET top_red_flags = '[]'::jsonb
WHERE top_red_flags IS NULL;

-- 4) Helper: fetch latest evidence-backed scan for a normalized URL
CREATE OR REPLACE FUNCTION get_latest_scan_by_normalized_url(p_normalized_url TEXT)
RETURNS TABLE (
  id UUID,
  badge TEXT,
  score INTEGER,
  domain TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT sr.id, sr.badge::TEXT, sr.score, sr.domain, sr.created_at
  FROM scan_results sr
  WHERE sr.normalized_url = p_normalized_url
  ORDER BY sr.created_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION get_latest_scan_by_normalized_url IS
  'Returns the most recent evidence-backed scan for a canonical normalized URL.';

-- 5) Ensure increment_share_view exists (no-op if already defined)
CREATE OR REPLACE FUNCTION increment_share_view(p_token VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE wallet_share_links
  SET view_count = COALESCE(view_count, 0) + 1,
      last_viewed_at = NOW()
  WHERE token = p_token
    AND expires_at > NOW();
END;
$$;
