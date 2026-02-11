export type BadgeType = 'VERIFIED' | 'UNVERIFIED' | 'HIGH_RISK';

export type EvidenceStatus = 'pass' | 'warn' | 'fail' | 'pending' | 'unknown';

export type EvidenceProvider = 'link_intel' | 'domain_intel' | 'social_context' | 'pattern_match' | 'ssl_intel' | 'google_safe_browsing' | 'virustotal' | 'reputation_reports' | 'content_intel';

export interface EvidencePayload {
  [key: string]: unknown;
}

export interface LinkIntelPayload extends EvidencePayload {
  originalUrl?: string;
  finalUrl?: string;
  redirectChain?: string[];
  redirectCount?: number;
  hasDoubleHop?: boolean;
  trackingParams?: string[];
  shortlinkExpanded?: boolean;
  suspiciousRedirect?: boolean;
}

export interface SslAnalysis {
  hasSSL: boolean;
  certAgeDays: number | null;
  certExpiresInDays: number | null;
  isSelfSigned: boolean;
  issuer: string | null;
  subjectMismatch: boolean;
  validFrom: string | null;
  validTo: string | null;
}

export interface DomainIntelPayload extends EvidencePayload {
  domain?: string;
  domainAge?: number;
  domainAgeDays?: number;
  registrar?: string;
  createdDate?: string;
  updatedDate?: string;
  expiresDate?: string;
  isPunycode?: boolean;
  isLookalike?: boolean;
  lookalikeTo?: string;
  suspiciousTld?: boolean;
  tld?: string;
  hasMxRecords?: boolean;
  asnRisk?: 'low' | 'medium' | 'high';
  hostingProvider?: string;
  ssl?: SslAnalysis | null;
}

export interface SocialContextPayload extends EvidencePayload {
  platform?: string;
  accountAge?: number;
  followerCount?: number;
  engagementRate?: number;
  verifiedAccount?: boolean;
  suspiciousActivity?: boolean;
  recentAccountChanges?: boolean;
}

export interface PatternMatchPayload extends EvidencePayload {
  matchedPatterns?: string[];
  matchedKeywords?: string[];
  keywordCount?: number;
  phishingScore?: number;
  scamKeywords?: string[];
  knownScamMatch?: boolean;
  knownScamReason?: string | null;
  patternMatches?: string[];
  reportCount?: number;
  reportWeight?: number;
  similarReportedUrls?: number;
}

export interface EvidenceCard {
  id: string;
  provider: EvidenceProvider | string;
  providerLabel: string;
  status: EvidenceStatus;
  summary: string;
  weight: number;
  scoreImpact: number;
  payload?: EvidencePayload | LinkIntelPayload | DomainIntelPayload | SocialContextPayload | PatternMatchPayload;
  timestamp?: number;
  details?: string[];
}

export interface ReasonDetail {
  title: string;
  summary: string;
  details: string[];
  suggestion?: string;
}

export interface ScanReasons {
  A: ReasonDetail;
  B: ReasonDetail;
  C: ReasonDetail;
  D: ReasonDetail;
  E: ReasonDetail;
  F: ReasonDetail;
}

export interface ContentMetrics {
  aiProbability: number;
  humanProbability: number;
  authenticityScore: number;
  manipulationRisk: number;
  scamIndicators: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface ScanResult {
  id: string;
  url: string;
  finalUrl?: string;
  domain: string;
  platform: 'tiktok' | 'instagram' | 'facebook' | 'youtube' | 'twitter' | 'linkedin' | 'reddit' | 'news' | 'shop' | 'crypto' | 'other';
  badge: BadgeType;
  score: number;
  reasons: ScanReasons;
  timestamp: number;
  thumbnail?: string;
  title?: string;
  metrics?: ContentMetrics;
  scanVersion?: string;
  evidence?: EvidenceCard[];
  summary?: string;
  scoreBreakdown?: ScoreBreakdown;
  isMock?: boolean;
}

export interface ScoreBreakdown {
  baseScore: number;
  adjustments: ScoreAdjustment[];
  finalScore: number;
  badge: BadgeType;
}

export interface ScoreAdjustment {
  provider: string;
  reason: string;
  impact: number;
  severity: 'critical' | 'major' | 'minor' | 'info';
}

export interface ShareCard {
  title: string;
  domain: string;
  badge: BadgeType;
  score: number;
}

export type FilterType = 'all' | 'verified' | 'unverified' | 'high_risk';

export interface Settings {
  language: 'en' | 'es';
  privacyMode: boolean;
  saveHistory: boolean;
  autoDelete: '7' | '30' | 'never';
  advancedScan: boolean;
}

export interface ContentScanRequest {
  url: string;
}

export interface ContentScanResponse {
  scan_id: string;
  badge: BadgeType;
  score: number;
  summary: string;
  evidence: {
    provider: string;
    status: 'pass' | 'warn' | 'fail';
    summary: string;
    weight: number;
    payload: Record<string, unknown>;
  }[];
  score_breakdown?: ScoreBreakdown;
}

export type ReportType = 'scam' | 'phishing' | 'spam' | 'misleading' | 'safe' | 'other';

export type TrustTier = 'trusted' | 'neutral' | 'suspicious' | 'malicious' | 'unknown';

export interface DomainTrustProfile {
  domain: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalScans: number;
  verifiedCount: number;
  unverifiedCount: number;
  highRiskCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  totalReports: number;
  scamReports: number;
  safeReports: number;
  trustTier: TrustTier;
  tierLocked: boolean;
}

export interface ContentIntelPayload extends EvidencePayload {
  fetchSuccess?: boolean;
  contentLength?: number;
  detectedLanguage?: string;
  urgencyMatches?: string[];
  impersonationMatches?: string[];
  scamPhraseMatches?: string[];
  totalFlags?: number;
}

export interface ReportScanRequest {
  scan_id?: string;
  url: string;
  report_type: ReportType;
  description?: string;
}

export interface ReportScanResponse {
  report_id: string;
  message: string;
  total_reports: number;
}

// Money Case Types
export type MoneyCaseIssue = 
  | 'unauthorized_charge'
  | 'product_not_received'
  | 'product_not_as_described'
  | 'duplicate_charge'
  | 'subscription_cancellation'
  | 'refund_not_processed'
  | 'scam_fraud'
  | 'other';

export type MoneyCaseStatus = 'draft' | 'submitted' | 'in_progress' | 'resolved' | 'escalated' | 'closed';

export type PaymentMethodType = 
  | 'credit_card'
  | 'debit_card'
  | 'paypal'
  | 'venmo'
  | 'zelle'
  | 'cash_app'
  | 'apple_pay'
  | 'google_pay'
  | 'bank_transfer'
  | 'crypto'
  | 'gift_card'
  | 'other';

export type DesiredOutcome = 
  | 'full_refund'
  | 'partial_refund'
  | 'replacement'
  | 'store_credit'
  | 'chargeback'
  | 'other';

export interface MoneyCaseInput {
  share_token?: string;
  issue_type: MoneyCaseIssue;
  amount_cents?: number;
  currency?: string;
  transaction_date?: string;
  payment_method?: PaymentMethodType;
  merchant_name?: string;
  merchant_url?: string;
  description?: string;
  desired_outcome?: DesiredOutcome;
  locale?: 'en' | 'es';
}

export interface RailPack {
  locale: string;
  generated_at: string;
  refund_request_template: string;
  follow_up_template: string;
  escalation_checklist: string[];
  evidence_checklist: string[];
  disclaimer: string;
}

export interface MoneyCaseResponse {
  ok: boolean;
  case_id: string;
  status: MoneyCaseStatus;
  rail_pack: RailPack;
  created_at: string;
}

export interface CaseEvent {
  id: string;
  case_id: string;
  event_type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CaseArtifact {
  id: string;
  case_id: string;
  artifact_type: string;
  filename?: string;
  mime_type?: string;
  file_url?: string;
  file_size_bytes?: number;
  description?: string;
  uploaded_at: string;
}

export interface MoneyCaseDetail {
  id: string;
  share_token?: string;
  issue_type: MoneyCaseIssue;
  status: MoneyCaseStatus;
  amount_cents?: number;
  currency?: string;
  transaction_date?: string;
  payment_method?: PaymentMethodType;
  merchant_name?: string;
  merchant_url?: string;
  description?: string;
  desired_outcome?: DesiredOutcome;
  locale?: string;
  created_at: string;
  updated_at: string;
}

export interface MoneyCaseFullResponse {
  ok: boolean;
  case: MoneyCaseDetail;
  rail_pack: RailPack;
  events: CaseEvent[];
  artifacts: CaseArtifact[];
}
