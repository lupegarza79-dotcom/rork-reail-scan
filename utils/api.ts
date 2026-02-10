// utils/api.ts
import Constants from "expo-constants";
import { getDeviceId } from "./deviceId";
import type { 
  BadgeType, 
  EvidenceCard, 
  ScoreBreakdown,
  ContentScanResponse,
  ReportScanRequest,
  ReportScanResponse,
  MoneyCaseInput,
  MoneyCaseResponse,
  MoneyCaseFullResponse,
} from "@/types/scan";
import { getProviderLabel } from "./evidenceEngine";

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL as string) ??
  "https://api.reail.app";

const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ??
  "";

async function headers(): Promise<Record<string, string>> {
  const deviceId = await getDeviceId();
  const h: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
  };
  if (ANON_KEY) {
    h["Authorization"] = `Bearer ${ANON_KEY}`;
    h["apikey"] = ANON_KEY;
  }
  return h;
}

export type BackendScanResult = {
  id: string;
  url?: string;
  finalUrl?: string;
  domain?: string;
  title?: string;
  badge: BadgeType;
  score: number;
  reasons?: Record<string, unknown>;
  timestamp?: number;
  evidence?: EvidenceCard[];
  summary?: string;
  scoreBreakdown?: ScoreBreakdown;
};

export interface ContentScanResult {
  scanId: string;
  badge: BadgeType;
  score: number;
  summary: string;
  evidence: EvidenceCard[];
  scoreBreakdown?: ScoreBreakdown;
  url?: string;
  finalUrl?: string;
  domain?: string;
}

export async function postScanUrl(payload: {
  url: string;
  title?: string;
  score?: number;
  reasons?: unknown;
  entityType?: "domain" | "vendor" | "creator" | "link";
  entityKey?: string;
}): Promise<(BackendScanResult & { entity?: unknown }) | null> {
  try {
    const resp = await fetch(`${BASE_URL}/content-scan`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ url: payload.url }),
    });
    if (!resp.ok) {
      console.log("[API] postScanUrl failed:", resp.status);
      return null;
    }
    const data = await resp.json() as ContentScanResponse;
    return {
      id: data.scan_id,
      badge: data.badge,
      score: data.score,
      summary: data.summary,
      url: payload.url,
      domain: undefined,
    };
  } catch (err) {
    console.log("[API] postScanUrl error:", err);
    return null;
  }
}

export async function fetchScanResultById(scanId: string): Promise<BackendScanResult | null> {
  if (!scanId) return null;

  try {
    console.log("[API] fetchScanResultById:", scanId);
    const resp = await fetch(`${BASE_URL}/scan-result?scanId=${encodeURIComponent(scanId)}`, {
      method: "GET",
      headers: await headers(),
    });

    if (!resp.ok) {
      console.log("[API] fetchScanResultById failed:", resp.status);
      return null;
    }
    const data = await resp.json();
    console.log("[API] fetchScanResultById ok");
    return data as BackendScanResult;
  } catch (err) {
    console.log("[API] fetchScanResultById error:", err);
    return null;
  }
}

export async function fetchAlerts(): Promise<{ items: unknown[] } | null> {
  try {
    const resp = await fetch(`${BASE_URL}/alerts`, {
      method: "GET",
      headers: await headers(),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as { items: unknown[] };
  } catch {
    return null;
  }
}

export async function markAlertReadApi(id: string): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/alerts/read`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ id }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function markAllAlertsReadApi(): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/alerts/read-all`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({}),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function fetchWatchlist(): Promise<{ items: unknown[] } | null> {
  try {
    const resp = await fetch(`${BASE_URL}/watchlist`, {
      method: "GET",
      headers: await headers(),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as { items: unknown[] };
  } catch {
    return null;
  }
}

export async function addWatchlistApi(type: string, key: string): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/watchlist/add`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ type, key }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function toggleWatchlistApi(id: string, enabled: boolean): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/watchlist/toggle`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ id, enabled }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function removeWatchlistApi(id: string): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/watchlist/remove`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ id }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function contentScan(url: string): Promise<ContentScanResult | null> {
  console.log("[API] contentScan called with:", url);
  
  try {
    const resp = await fetch(`${BASE_URL}/content-scan`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ url }),
    });

    if (!resp.ok) {
      console.log("[API] contentScan failed:", resp.status);
      return null;
    }

    const data = await resp.json() as ContentScanResponse;
    console.log("[API] contentScan response:", data);

    const evidence: EvidenceCard[] = (data.evidence || []).map((e, idx) => ({
      id: `${e.provider}-${idx}`,
      provider: e.provider,
      providerLabel: getProviderLabel(e.provider),
      status: e.status,
      summary: e.summary,
      weight: e.weight || 25,
      scoreImpact: 0,
      payload: e.payload,
      timestamp: Date.now(),
    }));

    return {
      scanId: data.scan_id,
      badge: data.badge,
      score: data.score,
      summary: data.summary,
      evidence,
      scoreBreakdown: data.score_breakdown,
    };
  } catch (err) {
    console.log("[API] contentScan error:", err);
    return null;
  }
}

export async function fetchScanEvidence(scanId: string): Promise<EvidenceCard[] | null> {
  if (!scanId) return null;

  try {
    console.log("[API] fetchScanEvidence:", scanId);
    const resp = await fetch(`${BASE_URL}/scan-evidence?scanId=${encodeURIComponent(scanId)}`, {
      method: "GET",
      headers: await headers(),
    });

    if (!resp.ok) return null;
    
    const data = await resp.json() as { evidence: {
      provider: string;
      status: 'pass' | 'warn' | 'fail' | 'pending';
      summary: string;
      weight: number;
      payload: Record<string, unknown>;
    }[] };

    return (data.evidence || []).map((e, idx) => ({
      id: `${e.provider}-${idx}`,
      provider: e.provider,
      providerLabel: getProviderLabel(e.provider),
      status: e.status,
      summary: e.summary,
      weight: e.weight || 25,
      scoreImpact: 0,
      payload: e.payload,
      timestamp: Date.now(),
    }));
  } catch {
    return null;
  }
}

export async function fetchScanWithEvidence(scanId: string): Promise<BackendScanResult | null> {
  if (!scanId) return null;

  try {
    const [scanResult, evidence] = await Promise.all([
      fetchScanResultById(scanId),
      fetchScanEvidence(scanId),
    ]);

    if (!scanResult) return null;

    return {
      ...scanResult,
      evidence: evidence || undefined,
    };
  } catch {
    return null;
  }
}

export interface ScanHistoryItem {
  scanId: string;
  url?: string;
  domain: string;
  title?: string;
  badge: BadgeType;
  score: number;
  summary?: string;
  createdAt: string;
}

export interface ScanHistoryResponse {
  items: ScanHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function reportScan(req: ReportScanRequest): Promise<ReportScanResponse | null> {
  try {
    console.log("[API] reportScan:", req.url, req.report_type);
    const resp = await fetch(`${BASE_URL}/report-scan`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify(req),
    });
    if (!resp.ok) {
      console.log("[API] reportScan failed:", resp.status);
      return null;
    }
    const data = await resp.json() as ReportScanResponse;
    console.log("[API] reportScan ok:", data.report_id);
    return data;
  } catch (err) {
    console.log("[API] reportScan error:", err);
    return null;
  }
}

export interface QuickScanResult {
  badge: BadgeType | null;
  score: number | null;
  top_red_flags: string[];
  scan_id: string | null;
  cache_hit: boolean;
  domain: string;
  message?: string;
}

export async function quickScan(url: string): Promise<QuickScanResult | null> {
  try {
    console.log("[API] quickScan:", url);
    const resp = await fetch(`${BASE_URL}/quick-scan?url=${encodeURIComponent(url)}`, {
      method: "GET",
      headers: await headers(),
    });
    if (!resp.ok) {
      console.log("[API] quickScan failed:", resp.status);
      return null;
    }
    const data = await resp.json() as QuickScanResult;
    console.log("[API] quickScan ok:", data.badge, data.score);
    return data;
  } catch (err) {
    console.log("[API] quickScan error:", err);
    return null;
  }
}

export async function fetchScanHistory(options?: { limit?: number; offset?: number }): Promise<ScanHistoryResponse | null> {
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  try {
    const resp = await fetch(`${BASE_URL}/scan-history?limit=${limit}&offset=${offset}`, {
      method: "GET",
      headers: await headers(),
    });

    if (!resp.ok) {
      console.log("[API] fetchScanHistory failed:", resp.status);
      return null;
    }

    const data = await resp.json() as ScanHistoryResponse;
    console.log("[API] fetchScanHistory:", data.items.length, "items");
    return data;
  } catch (err) {
    console.log("[API] fetchScanHistory error:", err);
    return null;
  }
}

export async function createMoneyCase(input: MoneyCaseInput): Promise<MoneyCaseResponse | null> {
  try {
    console.log("[API] createMoneyCase:", input.issue_type);
    const resp = await fetch(`${BASE_URL}/money-case`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify(input),
    });
    if (!resp.ok) {
      console.log("[API] createMoneyCase failed:", resp.status);
      return null;
    }
    const data = await resp.json() as MoneyCaseResponse;
    console.log("[API] createMoneyCase ok:", data.case_id);
    return data;
  } catch (err) {
    console.log("[API] createMoneyCase error:", err);
    return null;
  }
}

export async function contentScanText(text: string): Promise<ContentScanResult | null> {
  console.log("[API] contentScanText called");
  try {
    const resp = await fetch(`${BASE_URL}/content-scan`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ content_text: text }),
    });
    if (!resp.ok) {
      console.log("[API] contentScanText failed:", resp.status);
      return null;
    }
    const data = await resp.json() as ContentScanResponse;
    console.log("[API] contentScanText response:", data);
    const evidence: EvidenceCard[] = (data.evidence || []).map((e, idx) => ({
      id: `${e.provider}-${idx}`,
      provider: e.provider,
      providerLabel: getProviderLabel(e.provider),
      status: e.status,
      summary: e.summary,
      weight: e.weight || 25,
      scoreImpact: 0,
      payload: e.payload,
      timestamp: Date.now(),
    }));
    return {
      scanId: data.scan_id,
      badge: data.badge,
      score: data.score,
      summary: data.summary,
      evidence,
      scoreBreakdown: data.score_breakdown,
    };
  } catch (err) {
    console.log("[API] contentScanText error:", err);
    return null;
  }
}

export async function fetchMoneyCase(caseId: string): Promise<MoneyCaseFullResponse | null> {
  try {
    console.log("[API] fetchMoneyCase:", caseId);
    const resp = await fetch(`${BASE_URL}/money-case?case_id=${encodeURIComponent(caseId)}`, {
      method: "GET",
      headers: await headers(),
    });
    if (!resp.ok) {
      console.log("[API] fetchMoneyCase failed:", resp.status);
      return null;
    }
    const data = await resp.json() as MoneyCaseFullResponse;
    console.log("[API] fetchMoneyCase ok");
    return data;
  } catch (err) {
    console.log("[API] fetchMoneyCase error:", err);
    return null;
  }
}
