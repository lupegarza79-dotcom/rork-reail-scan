import AsyncStorage from "@react-native-async-storage/async-storage";

export type AlertBadge = "VERIFIED" | "UNVERIFIED" | "HIGH_RISK";
export type AlertSeverity = "low" | "med" | "high";
export type EntityType = "domain" | "vendor" | "creator" | "link";

export type ReailAlert = {
  id: string;
  createdAt: string;
  entityType: EntityType;
  entityKey: string;
  scanId?: string;
  badge: AlertBadge;
  score: number;
  message: string;
  topReasons?: { key: string; summary: string }[];
  readAt?: string | null;
};

export type WatchItem = {
  id: string;
  entityType: EntityType;
  entityKey: string;
  alertsEnabled: boolean;
  createdAt: string;
};

const ALERTS_KEY = "reail_alerts_v1";
const WATCH_KEY = "reail_watchlist_v1";

function uid(prefix = "a") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function loadAlerts(): Promise<ReailAlert[]> {
  try {
    const raw = await AsyncStorage.getItem(ALERTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveAlerts(alerts: ReailAlert[]) {
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts.slice(0, 300)));
}

export async function addAlert(partial: Omit<ReailAlert, "id" | "createdAt">) {
  const alerts = await loadAlerts();
  const next: ReailAlert = {
    id: uid("alert"),
    createdAt: new Date().toISOString(),
    readAt: null,
    ...partial,
  };
  const merged = [next, ...alerts].slice(0, 300);
  await saveAlerts(merged);
  return merged;
}

export async function markAlertRead(alertId: string) {
  const alerts = await loadAlerts();
  const merged = alerts.map((a) =>
    a.id === alertId ? { ...a, readAt: new Date().toISOString() } : a
  );
  await saveAlerts(merged);
  return merged;
}

export async function markAllRead() {
  const alerts = await loadAlerts();
  const now = new Date().toISOString();
  const merged = alerts.map((a) => ({ ...a, readAt: now }));
  await saveAlerts(merged);
  return merged;
}

export async function clearAlerts() {
  await AsyncStorage.removeItem(ALERTS_KEY);
}

export async function loadWatchlist(): Promise<WatchItem[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCH_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveWatchlist(items: WatchItem[]) {
  await AsyncStorage.setItem(WATCH_KEY, JSON.stringify(items.slice(0, 300)));
}

export async function addWatch(entityType: EntityType, entityKey: string) {
  const items = await loadWatchlist();
  const key = entityKey.trim();
  if (!key) return items;

  const filtered = items.filter((w) => !(w.entityType === entityType && w.entityKey === key));
  const next: WatchItem = {
    id: uid("watch"),
    entityType,
    entityKey: key,
    alertsEnabled: true,
    createdAt: new Date().toISOString(),
  };
  const merged = [next, ...filtered].slice(0, 300);
  await saveWatchlist(merged);
  return merged;
}

export async function toggleWatch(id: string, enabled: boolean) {
  const items = await loadWatchlist();
  const merged = items.map((w) => (w.id === id ? { ...w, alertsEnabled: enabled } : w));
  await saveWatchlist(merged);
  return merged;
}

export async function removeWatch(id: string) {
  const items = await loadWatchlist();
  const merged = items.filter((w) => w.id !== id);
  await saveWatchlist(merged);
  return merged;
}

export async function seedDemoAlertsIfEmpty() {
  const existing = await loadAlerts();
  if (existing.length) return existing;

  const demo: ReailAlert[] = [
    {
      id: uid("alert"),
      createdAt: new Date().toISOString(),
      entityType: "domain",
      entityKey: "tiktok.com",
      scanId: "",
      badge: "HIGH_RISK",
      score: 24,
      message: "High-risk signals detected on a shared TikTok listing.",
      topReasons: [
        { key: "E", summary: "Suspicious link redirects / phishing signals." },
        { key: "F", summary: "Pattern matches known scam structures." },
      ],
      readAt: null,
    },
    {
      id: uid("alert"),
      createdAt: new Date().toISOString(),
      entityType: "domain",
      entityKey: "facebook.com",
      badge: "UNVERIFIED",
      score: 61,
      message: "Unverified listing: not enough evidence to confirm authenticity.",
      topReasons: [{ key: "C", summary: "Claims not supported by public signals." }],
      readAt: null,
    },
  ];

  await saveAlerts(demo);
  return demo;
}
