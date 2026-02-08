-- Migration: Money Cases v1 (Refund/Dispute Rails)
-- Adds tables for tracking payment disputes and generating Rail Packs

-- Issue types enum
CREATE TYPE money_case_issue AS ENUM (
  'unauthorized_charge',
  'product_not_received',
  'product_not_as_described',
  'duplicate_charge',
  'subscription_cancellation',
  'refund_not_processed',
  'scam_fraud',
  'other'
);

-- Case status enum
CREATE TYPE money_case_status AS ENUM (
  'draft',
  'submitted',
  'in_progress',
  'resolved',
  'escalated',
  'closed'
);

-- Payment method enum
CREATE TYPE payment_method_type AS ENUM (
  'credit_card',
  'debit_card',
  'paypal',
  'venmo',
  'zelle',
  'cash_app',
  'apple_pay',
  'google_pay',
  'bank_transfer',
  'crypto',
  'gift_card',
  'other'
);

-- Desired outcome enum
CREATE TYPE desired_outcome AS ENUM (
  'full_refund',
  'partial_refund',
  'replacement',
  'store_credit',
  'chargeback',
  'other'
);

-- Main money_cases table
CREATE TABLE IF NOT EXISTS money_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to share token (optional)
  share_token VARCHAR(32) REFERENCES wallet_share_links(token) ON DELETE SET NULL,
  scan_id UUID REFERENCES scan_results(id) ON DELETE SET NULL,
  
  -- Case info
  issue_type money_case_issue NOT NULL,
  status money_case_status DEFAULT 'draft',
  
  -- Transaction details
  amount_cents INTEGER,
  currency VARCHAR(3) DEFAULT 'USD',
  transaction_date DATE,
  payment_method payment_method_type,
  
  -- Merchant info
  merchant_name VARCHAR(255),
  merchant_url TEXT,
  merchant_domain VARCHAR(255),
  
  -- User input
  description TEXT,
  desired_outcome desired_outcome,
  
  -- Rail Pack (generated)
  rail_pack JSONB,
  
  -- Metadata
  device_id VARCHAR(255),
  ip VARCHAR(45),
  locale VARCHAR(10) DEFAULT 'en',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_money_cases_share_token ON money_cases(share_token);
CREATE INDEX idx_money_cases_device ON money_cases(device_id);
CREATE INDEX idx_money_cases_status ON money_cases(status);
CREATE INDEX idx_money_cases_created ON money_cases(created_at DESC);
CREATE INDEX idx_money_cases_merchant ON money_cases(merchant_domain);

COMMENT ON TABLE money_cases IS 'User-submitted payment dispute cases for Rail Pack generation';
COMMENT ON COLUMN money_cases.rail_pack IS 'Generated Rail Pack with templates, checklists, and guidance';
COMMENT ON COLUMN money_cases.amount_cents IS 'Transaction amount in cents to avoid floating point issues';

-- Case events timeline
CREATE TABLE IF NOT EXISTS case_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES money_cases(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_events_case ON case_events(case_id);
CREATE INDEX idx_case_events_type ON case_events(event_type);
CREATE INDEX idx_case_events_created ON case_events(created_at);

COMMENT ON TABLE case_events IS 'Timeline of events for a money case';

-- Case artifacts (proof uploads, documents)
CREATE TABLE IF NOT EXISTS case_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES money_cases(id) ON DELETE CASCADE,
  
  artifact_type VARCHAR(50) NOT NULL,
  filename VARCHAR(255),
  mime_type VARCHAR(100),
  file_url TEXT,
  file_size_bytes INTEGER,
  
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_artifacts_case ON case_artifacts(case_id);
CREATE INDEX idx_case_artifacts_type ON case_artifacts(artifact_type);

COMMENT ON TABLE case_artifacts IS 'Uploaded proof and documents for money cases';

-- Update trigger for money_cases
CREATE OR REPLACE FUNCTION update_money_case_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_money_case_updated
  BEFORE UPDATE ON money_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_money_case_timestamp();

-- Function to add case event
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
  INSERT INTO case_events (case_id, event_type, title, description, metadata)
  VALUES (p_case_id, p_event_type, p_title, p_description, p_metadata)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION add_case_event IS 'Adds an event to a money case timeline';
