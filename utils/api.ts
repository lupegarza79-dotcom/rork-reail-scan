// utils/api.ts
import { getDeviceId } from "./deviceId";

export const BASE_URL = "https://api.reail.app";

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
  domain?: string;
  title?: string;
  badge: "VERIFIED" | "UNVERIFIED" | "HIGH_RISK";
  score: number;
  reasons?: any;
  timestamp?: number;
};

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
