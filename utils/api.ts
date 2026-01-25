// utils/api.ts
export const BASE_URL = "https://api.reail.app";

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

export async function fetchScanResultById(scanId: string): Promise<BackendScanResult | null> {
  if (!scanId) return null;

  try {
    const resp = await fetch(`${BASE_URL}/scan/result?scanId=${encodeURIComponent(scanId)}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return data as BackendScanResult;
  } catch {
    return null;
  }
}
