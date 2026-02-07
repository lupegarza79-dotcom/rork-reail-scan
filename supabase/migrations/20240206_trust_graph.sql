-- Migration: Trust Graph schema
-- Tracks domain behavior over time for deterministic reputation scoring
-- Does NOT break existing tables or scoring determinism

-- 1) Add content_intel provider
DO $$ BEGIN
  ALTER TYPE evidence_provider ADD VALUE IF NOT EXISTS 'content_intel';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Domain trust profiles – one row per domain, updated deterministically after each scan
CREATE TABLE IF NOT EXISTS domain_trust_profiles (
  domain TEXT PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_scans INTEGER NOT NULL DEFAULT 1,
  verified_count INTEGER NOT NULL DEFAULT 0,
  unverified_count INTEGER NOT NULL DEFAULT 0,
  high_risk_count INTEGER NOT NULL DEFAULT 0,
  avg_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  min_score INTEGER NOT NULL DEFAULT 100,
  max_score INTEGER NOT NULL DEFAULT 0,
  total_reports INTEGER NOT NULL DEFAULT 0,
  scam_reports INTEGER NOT NULL DEFAULT 0,
  safe_reports INTEGER NOT NULL DEFAULT 0,
  trust_tier TEXT NOT NULL DEFAULT 'unknown'
    CHECK (trust_tier IN ('trusted', 'neutral', 'suspicious', 'malicious', 'unknown')),
  tier_locked BOOLEAN NOT NULL DEFAULT FALSE,
  meta JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dtp_trust_tier ON domain_trust_profiles(trust_tier);
CREATE INDEX IF NOT EXISTS idx_dtp_last_seen ON domain_trust_profiles(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_dtp_avg_score ON domain_trust_profiles(avg_score);

-- 3) Domain scan edges – links each scan to its domain profile for graph traversal
CREATE TABLE IF NOT EXISTS domain_scan_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL REFERENCES domain_trust_profiles(domain) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
  badge TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dse_domain ON domain_scan_edges(domain);
CREATE INDEX IF NOT EXISTS idx_dse_scan_id ON domain_scan_edges(scan_id);
CREATE INDEX IF NOT EXISTS idx_dse_created ON domain_scan_edges(created_at DESC);

-- 4) Domain relationships – tracks redirect chains, affiliate links, shared hosting
CREATE TABLE IF NOT EXISTS domain_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_domain TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  relationship_type TEXT NOT NULL
    CHECK (relationship_type IN ('redirect', 'affiliate', 'shared_hosting', 'subdomain', 'lookalike')),
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  seen_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (source_domain, target_domain, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_dr_source ON domain_relationships(source_domain);
CREATE INDEX IF NOT EXISTS idx_dr_target ON domain_relationships(target_domain);

-- 5) Deterministic function: upsert domain trust profile after a scan
CREATE OR REPLACE FUNCTION upsert_domain_trust(
  p_domain TEXT,
  p_badge TEXT,
  p_score INTEGER
) RETURNS VOID AS $$
DECLARE
  v_verified INTEGER;
  v_unverified INTEGER;
  v_high_risk INTEGER;
  v_total INTEGER;
  v_avg NUMERIC;
  v_tier TEXT;
BEGIN
  INSERT INTO domain_trust_profiles (domain, first_seen_at, last_seen_at, total_scans,
    verified_count, unverified_count, high_risk_count, avg_score, min_score, max_score)
  VALUES (p_domain, NOW(), NOW(), 1,
    CASE WHEN p_badge = 'VERIFIED' THEN 1 ELSE 0 END,
    CASE WHEN p_badge = 'UNVERIFIED' THEN 1 ELSE 0 END,
    CASE WHEN p_badge = 'HIGH_RISK' THEN 1 ELSE 0 END,
    p_score, p_score, p_score)
  ON CONFLICT (domain) DO UPDATE SET
    last_seen_at = NOW(),
    total_scans = domain_trust_profiles.total_scans + 1,
    verified_count = domain_trust_profiles.verified_count + CASE WHEN p_badge = 'VERIFIED' THEN 1 ELSE 0 END,
    unverified_count = domain_trust_profiles.unverified_count + CASE WHEN p_badge = 'UNVERIFIED' THEN 1 ELSE 0 END,
    high_risk_count = domain_trust_profiles.high_risk_count + CASE WHEN p_badge = 'HIGH_RISK' THEN 1 ELSE 0 END,
    avg_score = (domain_trust_profiles.avg_score * domain_trust_profiles.total_scans + p_score)
                / (domain_trust_profiles.total_scans + 1),
    min_score = LEAST(domain_trust_profiles.min_score, p_score),
    max_score = GREATEST(domain_trust_profiles.max_score, p_score),
    updated_at = NOW();

  -- Recompute tier deterministically (skip if locked by admin)
  SELECT verified_count, unverified_count, high_risk_count, total_scans, avg_score
    INTO v_verified, v_unverified, v_high_risk, v_total, v_avg
    FROM domain_trust_profiles WHERE domain = p_domain;

  IF v_total >= 3 AND v_high_risk::NUMERIC / v_total >= 0.6 THEN
    v_tier := 'malicious';
  ELSIF v_total >= 3 AND v_high_risk::NUMERIC / v_total >= 0.3 THEN
    v_tier := 'suspicious';
  ELSIF v_total >= 3 AND v_verified::NUMERIC / v_total >= 0.7 AND v_avg >= 80 THEN
    v_tier := 'trusted';
  ELSIF v_total >= 2 THEN
    v_tier := 'neutral';
  ELSE
    v_tier := 'unknown';
  END IF;

  UPDATE domain_trust_profiles
    SET trust_tier = v_tier
    WHERE domain = p_domain AND tier_locked = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) RLS
ALTER TABLE domain_trust_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_scan_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages trust profiles"
  ON domain_trust_profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages scan edges"
  ON domain_scan_edges FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages domain relationships"
  ON domain_relationships FOR ALL USING (auth.role() = 'service_role');

-- Public read for trust profiles (so the app can show trust tier)
CREATE POLICY "Anyone can read trust profiles"
  ON domain_trust_profiles FOR SELECT USING (true);
