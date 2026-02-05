-- Migration: scan_reports table
-- User-submitted reports that feed into pattern_match weighting

CREATE TYPE report_type AS ENUM ('scam', 'phishing', 'spam', 'misleading', 'safe', 'other');

CREATE TABLE scan_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  scan_id UUID REFERENCES scan_results(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  report_type report_type NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying in pattern_match provider
CREATE INDEX idx_scan_reports_url ON scan_reports(url);
CREATE INDEX idx_scan_reports_domain ON scan_reports(domain);
CREATE INDEX idx_scan_reports_created_at ON scan_reports(created_at DESC);
CREATE INDEX idx_scan_reports_device_id ON scan_reports(device_id);
CREATE INDEX idx_scan_reports_type ON scan_reports(report_type);

-- Composite index for the pattern_match OR query
CREATE INDEX idx_scan_reports_url_domain ON scan_reports(url, domain);

-- RLS Policies
ALTER TABLE scan_reports ENABLE ROW LEVEL SECURITY;

-- Users can view reports (public for transparency)
CREATE POLICY "Anyone can view reports"
  ON scan_reports FOR SELECT
  USING (true);

-- Users can insert their own reports
CREATE POLICY "Users can submit reports"
  ON scan_reports FOR INSERT
  WITH CHECK (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- Service role can manage all
CREATE POLICY "Service role can manage all reports"
  ON scan_reports FOR ALL
  USING (auth.role() = 'service_role');

-- Aggregated view for report counts per URL/domain
CREATE VIEW report_aggregates AS
SELECT 
  domain,
  url,
  COUNT(*) as total_reports,
  COUNT(*) FILTER (WHERE report_type = 'scam') as scam_count,
  COUNT(*) FILTER (WHERE report_type = 'phishing') as phishing_count,
  COUNT(*) FILTER (WHERE report_type = 'spam') as spam_count,
  COUNT(*) FILTER (WHERE report_type = 'misleading') as misleading_count,
  COUNT(*) FILTER (WHERE report_type = 'safe') as safe_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_reports,
  MAX(created_at) as last_reported_at
FROM scan_reports
GROUP BY domain, url;
