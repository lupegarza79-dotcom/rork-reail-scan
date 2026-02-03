-- Migration: scan_results + scan_evidence tables
-- Aligned with app types: BadgeType, EvidenceStatus, EvidenceProvider

-- Enums
CREATE TYPE badge_type AS ENUM ('VERIFIED', 'UNVERIFIED', 'HIGH_RISK');
CREATE TYPE evidence_status AS ENUM ('pass', 'warn', 'fail', 'pending');
CREATE TYPE evidence_provider AS ENUM ('link_intel', 'domain_intel', 'social_context', 'pattern_match');
CREATE TYPE platform_type AS ENUM ('tiktok', 'instagram', 'facebook', 'youtube', 'twitter', 'linkedin', 'reddit', 'news', 'shop', 'crypto', 'other');

-- scan_results table
CREATE TABLE scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  url TEXT NOT NULL,
  final_url TEXT,
  domain TEXT NOT NULL,
  platform platform_type DEFAULT 'other',
  badge badge_type NOT NULL DEFAULT 'UNVERIFIED',
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  summary TEXT,
  title TEXT,
  thumbnail TEXT,
  reasons JSONB,
  metrics JSONB,
  score_breakdown JSONB,
  scan_version TEXT DEFAULT '2.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- scan_evidence table
CREATE TABLE scan_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
  provider evidence_provider NOT NULL,
  provider_label TEXT NOT NULL,
  status evidence_status NOT NULL DEFAULT 'pending',
  summary TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 25 CHECK (weight >= 0 AND weight <= 100),
  score_impact INTEGER DEFAULT 0,
  payload JSONB,
  details TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_scan_results_device_id ON scan_results(device_id);
CREATE INDEX idx_scan_results_domain ON scan_results(domain);
CREATE INDEX idx_scan_results_created_at ON scan_results(created_at DESC);
CREATE INDEX idx_scan_results_badge ON scan_results(badge);
CREATE INDEX idx_scan_evidence_scan_id ON scan_evidence(scan_id);
CREATE INDEX idx_scan_evidence_provider ON scan_evidence(provider);
CREATE INDEX idx_scan_evidence_status ON scan_evidence(status);

-- Full-text search on URL/domain
CREATE INDEX idx_scan_results_url_gin ON scan_results USING gin(to_tsvector('english', url || ' ' || domain));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scan_results_updated_at
  BEFORE UPDATE ON scan_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_evidence ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read/write their own scans (by device_id header)
CREATE POLICY "Users can view their own scans"
  ON scan_results FOR SELECT
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

CREATE POLICY "Users can insert their own scans"
  ON scan_results FOR INSERT
  WITH CHECK (device_id = current_setting('request.headers', true)::json->>'x-device-id');

CREATE POLICY "Users can update their own scans"
  ON scan_results FOR UPDATE
  USING (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- Evidence inherits from scan ownership
CREATE POLICY "Users can view evidence for their scans"
  ON scan_evidence FOR SELECT
  USING (
    scan_id IN (
      SELECT id FROM scan_results 
      WHERE device_id = current_setting('request.headers', true)::json->>'x-device-id'
    )
  );

CREATE POLICY "Service role can manage all"
  ON scan_results FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all evidence"
  ON scan_evidence FOR ALL
  USING (auth.role() = 'service_role');

-- Useful view for scan + evidence join
CREATE VIEW scan_with_evidence AS
SELECT 
  sr.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', se.id,
        'provider', se.provider,
        'provider_label', se.provider_label,
        'status', se.status,
        'summary', se.summary,
        'weight', se.weight,
        'score_impact', se.score_impact,
        'payload', se.payload,
        'details', se.details
      ) ORDER BY se.created_at
    ) FILTER (WHERE se.id IS NOT NULL),
    '[]'
  ) AS evidence
FROM scan_results sr
LEFT JOIN scan_evidence se ON se.scan_id = sr.id
GROUP BY sr.id;
