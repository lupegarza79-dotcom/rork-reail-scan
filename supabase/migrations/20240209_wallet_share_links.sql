-- Migration: wallet_share_links
-- REAiL Wallet v1 (Share-to-Scan) - Mass distribution layer
-- IDEMPOTENT: safe to run against existing DB

CREATE TABLE IF NOT EXISTS wallet_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(32) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  domain VARCHAR(255),
  scan_id UUID REFERENCES scan_results(id) ON DELETE SET NULL,
  badge VARCHAR(20),
  score INTEGER,
  top_red_flags JSONB DEFAULT '[]'::jsonb,
  next_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  device_id VARCHAR(255),
  ip VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_wallet_share_token ON wallet_share_links(token);
CREATE INDEX IF NOT EXISTS idx_wallet_share_expires ON wallet_share_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_wallet_share_domain ON wallet_share_links(domain);
CREATE INDEX IF NOT EXISTS idx_wallet_share_created ON wallet_share_links(created_at DESC);

COMMENT ON TABLE wallet_share_links IS 'Share-to-Scan links for viral distribution of scan results';
COMMENT ON COLUMN wallet_share_links.token IS 'Short unique token for shareable URL (/s/:token)';
COMMENT ON COLUMN wallet_share_links.original_url IS 'The URL that was scanned';
COMMENT ON COLUMN wallet_share_links.next_action IS 'Recommended next best action for the user';
COMMENT ON COLUMN wallet_share_links.view_count IS 'Number of times this share link was viewed';

CREATE OR REPLACE FUNCTION cleanup_expired_share_links()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM wallet_share_links
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_share_links IS 'Removes expired share links, returns count deleted';

CREATE OR REPLACE FUNCTION increment_share_view(p_token VARCHAR)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE wallet_share_links
  SET view_count = view_count + 1,
      last_viewed_at = NOW()
  WHERE token = p_token
    AND expires_at > NOW();
END;
$$;
