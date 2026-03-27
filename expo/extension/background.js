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
    return { badge: null, score: null, error: "Extension not configured. Open settings and enter your API Base URL and Anon Key." };
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

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[REAiL bg] quickScan HTTP error:", resp.status, errText);
      return { badge: null, score: null, error: `Server error (${resp.status})` };
    }

    const data = await resp.json();
    scanCache.set(key, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.error("[REAiL bg] quickScan error:", err);
    return { badge: null, score: null, error: "Network error. Check your connection." };
  }
}

function clearCache(url) {
  if (url) {
    const key = cacheKey(url);
    scanCache.delete(key);
    console.log("[REAiL bg] cache cleared for:", key);
  } else {
    scanCache.clear();
    console.log("[REAiL bg] all cache cleared");
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "QUICK_SCAN") {
    quickScan(msg.url).then(sendResponse);
    return true;
  }
  if (msg.type === "CLEAR_CACHE") {
    clearCache(msg.url);
    sendResponse({ ok: true });
    return false;
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
        result.badge === "VERIFIED" ? "#10B981" :
        result.badge === "HIGH_RISK" ? "#EF4444" :
        result.badge === "UNVERIFIED" ? "#F59E0B" : "#71717A";
      const text =
        result.badge === "VERIFIED" ? "✓" :
        result.badge === "HIGH_RISK" ? "!" :
        result.badge === "UNVERIFIED" ? "?" : "";
      chrome.action.setBadgeBackgroundColor({ color, tabId });
      chrome.action.setBadgeText({ text, tabId });
    });
  }
});
