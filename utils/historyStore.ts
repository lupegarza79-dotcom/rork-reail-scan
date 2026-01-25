// utils/historyStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Badge = "VERIFIED" | "UNVERIFIED" | "HIGH_RISK";

export type ScanHistoryItem = {
  scanId?: string;
  badge: Badge;
  score: number;
  domain: string;
  title?: string;
  url?: string;        // scanned URL (optional)
  createdAt: string;   // ISO string
  reasons?: any;       // keep minimal or full reasons depending on privacy
};

const STORAGE_KEY = "reail_scan_history_v1";

function clampScore(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function safeDomain(input?: string) {
  if (!input) return "unknown";
  try {
    // if input is a URL
    return new URL(input).hostname;
  } catch {
    // if input is already domain-like
    return input.replace(/^https?:\/\//i, "").split("/")[0] || "unknown";
  }
}

export async function loadHistory(): Promise<ScanHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveToHistory(item: Partial<ScanHistoryItem>) {
  const badge = (item.badge as Badge) || "UNVERIFIED";
  const score = clampScore(item.score ?? 0);
  const domain = safeDomain(item.domain || item.url);

  const newItem: ScanHistoryItem = {
    scanId: item.scanId,
    badge,
    score,
    domain,
    title: item.title,
    url: item.url,
    createdAt: item.createdAt || new Date().toISOString(),
    reasons: item.reasons,
  };

  const history = await loadHistory();

  // de-dupe: if same scanId exists, replace it
  const filtered = newItem.scanId
    ? history.filter((h) => h.scanId !== newItem.scanId)
    : history;

  const next = [newItem, ...filtered].slice(0, 200); // cap history size
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearHistory() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function purgeOldHistory(days: number) {
  if (!days || days <= 0) return;
  const history = await loadHistory();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const kept = history.filter((h) => {
    const t = new Date(h.createdAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  return kept;
}
