export type BadgeType = 'VERIFIED' | 'UNVERIFIED' | 'HIGH_RISK';

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

export interface ScanResult {
  id: string;
  url: string;
  domain: string;
  platform: 'tiktok' | 'instagram' | 'facebook' | 'youtube' | 'news' | 'shop' | 'other';
  badge: BadgeType;
  score: number;
  reasons: ScanReasons;
  timestamp: number;
  thumbnail?: string;
  title?: string;
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
