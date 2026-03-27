// app/+native-intent.tsx
import { parseIncomingUrl, extractFirstHttpUrl } from "../utils/deepLinking";

/**
 * Expo Router native intent handler
 * This function receives a system "path" or shared content payload.
 * We normalize it and redirect to the right route.
 *
 * IMPORTANT:
 * - Return values are route strings like "/scanning?url=..." or "/result?scanId=..."
 * - If unknown, return "/" (home).
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  // 1) If path contains an http(s) URL anywhere, treat as Share-to-Scan payload.
  const httpUrl = extractFirstHttpUrl(path);
  if (httpUrl) {
    return `/scanning?url=${encodeURIComponent(httpUrl)}`;
  }

  // 2) Parse as deep link (reailscan://...) or router path patterns.
  const route = parseIncomingUrl(path);

  if (route.type === "result") {
    return `/result?scanId=${encodeURIComponent(route.scanId)}`;
  }

  if (route.type === "scan") {
    return `/scanning?url=${encodeURIComponent(route.url)}`;
  }

  // 3) Handle common formats like "/result/<id>" or "/scan?url=..."
  // If someone passes "/result/abc"
  if (path?.toLowerCase().startsWith("/result/")) {
    const scanId = path.split("/result/")[1]?.trim();
    if (scanId) return `/result?scanId=${encodeURIComponent(scanId)}`;
  }

  // If someone passes "/scan?url=..."
  if (path?.toLowerCase().startsWith("/scan")) {
    const idx = path.indexOf("url=");
    if (idx >= 0) {
      const url = path.substring(idx + 4);
      if (url) return `/scanning?url=${encodeURIComponent(url)}`;
    }
  }

  // Default: go home
  return "/";
}
