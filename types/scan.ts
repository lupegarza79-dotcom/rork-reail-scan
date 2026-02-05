export type BadgeType = 'VERIFIED' | 'UNVERIFIED' | 'HIGH_RISK';

export type EvidenceStatus = 'pass' | 'warn' | 'fail' | 'pending';

export type EvidenceProvider = 'link_intel' | 'domain_intel' | 'social_context' | 'pattern_match';

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
