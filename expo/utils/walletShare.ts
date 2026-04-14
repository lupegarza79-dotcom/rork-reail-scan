import { BASE_URL, headers } from "./api";
import type { BadgeType } from "@/types/scan";

export interface WalletShareData {
  token: string;
  original_url: string;
  domain: string;
  badge: BadgeType | null;
  score: number | null;
  top_red_flags: string[];
  next_action: string;
  scan_id: string | null;
  created_at: string;
  expires_at: string;
  view_count: number;
}

export interface CreateShareResponse {
  ok: boolean;
  token: string;
  share_url: string;
  original_url: string;
  domain: string;
  badge: BadgeType | null;
  score: number | null;
  top_red_flags: string[];
  next_action: string;
  expires_at: string;
  needs_full_scan: boolean;
}

export async function createShareLink(
  url: string,
  expiryHours?: number
): Promise<CreateShareResponse | null> {
  try {
    console.log("[WalletShare] Creating share link for:", url);
    const body: { url: string; expiry_hours?: number } = { url };
    if (expiryHours) {
      body.expiry_hours = expiryHours;
    }

    const resp = await fetch(`${BASE_URL}/wallet-share`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.log("[WalletShare] Create failed:", resp.status);
      return null;
    }

    const data = await resp.json() as CreateShareResponse;
    console.log("[WalletShare] Created:", data.token, data.badge);
    return data;
  } catch (err) {
    console.log("[WalletShare] Create error:", err);
    return null;
  }
}

export async function resolveShareLink(token: string): Promise<WalletShareData | null> {
  if (!token) return null;

  try {
    console.log("[WalletShare] Resolving token:", token);
    const resp = await fetch(`${BASE_URL}/wallet-share?token=${encodeURIComponent(token)}`, {
      method: "GET",
      headers: await headers(),
    });

    if (!resp.ok) {
      console.log("[WalletShare] Resolve failed:", resp.status);
      return null;
    }

    const data = await resp.json();
    if (!data.ok) {
      console.log("[WalletShare] Resolve error:", data.message);
      return null;
    }

    console.log("[WalletShare] Resolved:", data.domain, data.badge);
    return data as WalletShareData;
  } catch (err) {
    console.log("[WalletShare] Resolve error:", err);
    return null;
  }
}
