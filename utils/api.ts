// utils/api.ts
import Constants from "expo-constants";
import { getDeviceId } from "./deviceId";
import type { 
  BadgeType, 
  EvidenceCard, 
  ScoreBreakdown,
  ContentScanResponse 
} from "@/types/scan";
import { getProviderLabel } from "./evidenceEngine";

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL as string) ??
  "https://api.reail.app";

async function headers() {
  const deviceId = await getDeviceId();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
  };
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
  reasons?: any;
  entityType?: "domain" | "vendor" | "creator" | "link";
  entityKey?: string;
}): Promise<(BackendScanResult & { entity?: any }) | null> {
  try {
    const resp = await fetch(`${BASE_URL}/scan/url`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify(payload),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as BackendScanResult & { entity?: any };
  } catch {
    return null;
  }
}

export async function fetchScanResultById(scanId: string): Promise<BackendScanResult | null> {
  if (!scanId) return null;

  try {
    const resp = await fetch(`${BASE_URL}/scan/result?scanId=${encodeURIComponent(scanId)}`, {
      method: "GET",
      headers: await headers(),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data as BackendScanResult;
  } catch {
    return null;
  }
}

export async function fetchAlerts(): Promise<{ items: any[] } | null> {
  try {
    const resp = await fetch(`${BASE_URL}/alerts`, {
      method: "GET",
      headers: await headers(),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as { items: any[] };
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

export async function fetchWatchlist(): Promise<{ items: any[] } | null> {
  try {
    const resp = await fetch(`${BASE_URL}/watchlist`, {
      method: "GET",
      headers: await headers(),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as { items: any[] };
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
    const resp = await fetch(`${BASE_URL}/scan/content`, {
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
    const resp = await fetch(`${BASE_URL}/scan/evidence?scanId=${encodeURIComponent(scanId)}`, {
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
