import * as Linking from "expo-linking";

export const APP_SCHEME = "reailscan";
export const WEB_BASE_URL = "https://reail.app";

/**
 * Deep link builders
 */
export function buildResultLink(scanId: string, locale: "en" | "es" = "en") {
  return `${APP_SCHEME}://result?scanId=${encodeURIComponent(scanId)}&lang=${encodeURIComponent(locale)}`;
}

export function buildWebResultUrl(scanId: string) {
  return `${WEB_BASE_URL}/r/${encodeURIComponent(scanId)}`;
}

export function buildAppResultLink(scanId: string, locale: "en" | "es" = "en") {
  return `${APP_SCHEME}://result?scanId=${encodeURIComponent(scanId)}&lang=${encodeURIComponent(locale)}`;
}

export function buildScanLink(urlToScan: string, locale: "en" | "es" = "en") {
  return `${APP_SCHEME}://scan?url=${encodeURIComponent(urlToScan)}&lang=${encodeURIComponent(locale)}`;
}

/**
 * Extract the first http(s) URL from any shared text.
 */
export function extractFirstHttpUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match?.[0] ?? null;
}

/**
 * Parse incoming deep links and return a routing instruction.
 * We keep it simple and explicit.
 */
export type DeepLinkRoute =
  | { type: "result"; scanId: string }
  | { type: "scan"; url: string }
  | { type: "unknown" };

export function parseIncomingUrl(incoming: string | null | undefined): DeepLinkRoute {
  if (!incoming) return { type: "unknown" };

  const sharedHttp = extractFirstHttpUrl(incoming);
  if (sharedHttp) return { type: "scan", url: sharedHttp };

  try {
    const parsed = Linking.parse(incoming);

    const hostOrPath = (parsed.hostname || parsed.path || "").toLowerCase();
    const params = (parsed.queryParams || {}) as Record<string, any>;

    if (hostOrPath.includes("result")) {
      const scanId = String(params.scanId ?? "");
      if (scanId) return { type: "result", scanId };
    }

    if (hostOrPath.includes("scan")) {
      const url = String(params.url ?? "");
      if (url) return { type: "scan", url };
    }

    if (hostOrPath.startsWith("result/")) {
      const scanId = hostOrPath.split("result/")[1]?.trim();
      if (scanId) return { type: "result", scanId };
    }
  } catch {
    // If parse fails, treat as unknown
  }

  return { type: "unknown" };
}

/**
 * Listener helper: calls cb with raw URL every time app receives a deep link.
 */
export function addUrlListener(cb: (url: string) => void) {
  const sub = Linking.addEventListener("url", (event) => {
    if (event?.url) cb(event.url);
  });
  return () => sub.remove();
}

/**
 * Get initial URL when app starts.
 */
export async function getInitialURL(): Promise<string | null> {
  try {
    return await Linking.getInitialURL();
  } catch {
    return null;
  }
}

/**
 * Share a scan result via native share sheet.
 */
export async function shareResult(
  scan: { id: string; domain: string; score: number; badge: string },
  locale: "en" | "es" = "en"
): Promise<void> {
  const { Share } = await import('react-native');
  
  const link = buildResultLink(scan.id, locale);
  const badgeText = scan.badge === 'VERIFIED' ? '✅ Verified' 
    : scan.badge === 'HIGH_RISK' ? '⚠️ High Risk' 
    : '❓ Unverified';
  
  const message = locale === 'es'
    ? `REAiL Scan: ${scan.domain}\n${badgeText} • Score: ${scan.score}/100\n\n${link}`
    : `REAiL Scan: ${scan.domain}\n${badgeText} • Score: ${scan.score}/100\n\n${link}`;

  try {
    await Share.share({ message });
  } catch (error) {
    console.log('[shareResult] Error:', error);
  }
}
