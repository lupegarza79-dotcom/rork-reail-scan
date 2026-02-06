// REAiL Extension – Background Service Worker
// Calls quick-scan endpoint and caches results per tab

const DEFAULT_API_BASE = "";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min local cache

const scanCache = new Map();

async function getConfig() {
  const data = await chrome.storage.sync.get(["apiBase", "anonKey"]);
  return {
    apiBase: data.apiBase || DEFAULT_API_BASE,
    anonKey: data.anonKey || "",
  };
}

function cacheKey(url) {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

async function quickScan(url) {
  const key = cacheKey(url);
  const cached = scanCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log("[REAiL bg] cache hit:", key);
    return cached.data;
  }

  const { apiBase, anonKey } = await getConfig();
  if (!apiBase || !anonKey) {
    return { badge: null, score: null, error: "Extension not configured" };
  }

  try {
    const resp = await fetch(
      `${apiBase}/quick-scan?url=${encodeURIComponent(url)}`,
      {
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          "X-Device-Id": "reail-extension",
        },
      }
    );
    const data = await resp.json();
    scanCache.set(key, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.error("[REAiL bg] quickScan error:", err);
    return { badge: null, score: null, error: err.message };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "QUICK_SCAN") {
    quickScan(msg.url).then(sendResponse);
    return true; // async
  }
  if (msg.type === "GET_CONFIG") {
    getConfig().then(sendResponse);
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && tab.url.startsWith("http")) {
    quickScan(tab.url).then((result) => {
      const color =
        result.badge === "VERIFIED" ? "#16a34a" :
        result.badge === "HIGH_RISK" ? "#dc2626" :
        result.badge === "UNVERIFIED" ? "#d97706" : "#6b7280";
      const text =
        result.badge === "VERIFIED" ? "✓" :
        result.badge === "HIGH_RISK" ? "!" :
        result.badge === "UNVERIFIED" ? "?" : "";
      chrome.action.setBadgeBackgroundColor({ color, tabId });
      chrome.action.setBadgeText({ text, tabId });
    });
  }
});
