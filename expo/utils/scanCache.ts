// utils/scanCache.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "reail_scan_cache_v1:";
const INDEX_KEY = "reail_scan_cache_index_v1";

function keyFor(scanId: string) {
  return `${KEY_PREFIX}${scanId}`;
}

export async function cacheScanResult(scanId: string, payload: any) {
  if (!scanId) return;
  const k = keyFor(scanId);
  await AsyncStorage.setItem(k, JSON.stringify(payload));

  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [scanId, ...arr.filter((x) => x !== scanId)].slice(0, 200);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
  } catch {
    // ignore index failures
  }
}

export async function getCachedScanResult(scanId: string) {
  if (!scanId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(scanId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
