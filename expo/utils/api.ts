import Constants from "expo-constants";
import { getDeviceId } from "./deviceId";
import type { BadgeType } from "@/types/scan";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL as string) ??
  "";

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL as string) ??
  (SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1` : "https://favpzctusdjnnoyoabrz.supabase.co/functions/v1");

const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ??
  "";

export async function headers(): Promise<Record<string, string>> {
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
