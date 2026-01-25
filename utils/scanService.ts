// utils/scanService.ts
import { aiScanEngine } from "./aiScanEngine";
import { generateMockScan, detectPlatform } from "./mockScan";
import { saveToHistory } from "./historyStore";
import { cacheScanResult } from "./scanCache";

// If your project has path aliases (@/types/scan), keep them.
// If not, change to relative: ../types/scan
import type { ScanResult, BadgeType, ScanReasons } from "@/types/scan";

export interface ScanUrlRequest {
  url: string;
  advancedScan?: boolean;
}

export interface ScanMediaRequest {
  mediaUri: string;
  advancedScan?: boolean;
}

interface ReportScamRequest {
  scanId: string;
  category: string;
  reason?: string;
  notes?: string;
}

interface ApiScanResponse {
  id: string;
  badge: BadgeType;
  score: number;
  reasons: ScanReasons;
  domain?: string;
  title?: string;
  timestamp: number;
  disclaimerKey: string;
}

/**
 * ScanService
 * - Uses AI engine first (if enabled)
 * - Falls back to mock
 * - Optionally can call a backend later
 * - Auto-saves results into local history store
 */
class ScanService {
  // You can flip these later if needed
  useAI = true;
  useMock = true;

  // Optional future: backend endpoint
  apiBaseUrl: string | null = null;

  private normalizeUrl(url: string) {
    return (url || "").trim();
  }

  private extractDomain(url: string) {
    try {
      return new URL(url).hostname;
    } catch {
      return url.replace(/^https?:\/\//i, "").split("/")[0] || "unknown";
    }
  }

  private async recordHistory(result: ScanResult) {
    try {
      // Minimal safe fields; keep reasons as-is (you can redact later in privacyMode)
      await saveToHistory({
        scanId: result.id,
        badge: result.badge,
        score: result.score,
        domain: result.domain || this.extractDomain(result.url),
        title: result.title,
        url: result.url,
        createdAt: new Date(result.timestamp || Date.now()).toISOString(),
        reasons: result.reasons,
      });

      if (result.id) {
        await cacheScanResult(result.id, result);
      }
    } catch {
      // never crash scanning because of history
    }
  }

  private mapApiResponse(data: ApiScanResponse, url: string): ScanResult {
    return {
      id: data.id,
      url,
      badge: data.badge,
      score: data.score,
      reasons: data.reasons,
      timestamp: data.timestamp || Date.now(),
      domain: data.domain || this.extractDomain(url),
      platform: detectPlatform(url),
      title: data.title,
    };
  }

  async scanUrl(request: ScanUrlRequest): Promise<ScanResult> {
    const url = this.normalizeUrl(request.url);

    // 1) AI engine
    if (this.useAI) {
      try {
        const res = await aiScanEngine.analyzeUrl(url);
        // normalize missing fields
        const result: ScanResult = {
          ...res,
          url: res.url || url,
          domain: res.domain || this.extractDomain(url),
          platform: res.platform || detectPlatform(url),
          timestamp: res.timestamp || Date.now(),
        };
        await this.recordHistory(result);
        return result;
      } catch {
        // fall through
      }
    }

    // 2) Backend (optional)
    if (this.apiBaseUrl) {
      try {
        const resp = await fetch(`${this.apiBaseUrl}/scan/url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, advancedScan: !!request.advancedScan }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as ApiScanResponse;
          const result = this.mapApiResponse(data, url);
          await this.recordHistory(result);
          return result;
        }
      } catch {
        // fall through
      }
    }

    // 3) Mock fallback
    const mock = generateMockScan(url);
    const result: ScanResult = {
      ...mock,
      url,
      domain: mock.domain || this.extractDomain(url),
      platform: mock.platform || detectPlatform(url),
      timestamp: mock.timestamp || Date.now(),
    };
    await this.recordHistory(result);
    return result;
  }

  async scanMedia(request: ScanMediaRequest): Promise<ScanResult> {
    const mediaUri = (request.mediaUri || "").trim();

    // 1) AI engine on image
    if (this.useAI) {
      try {
        const res = await aiScanEngine.analyzeImage(mediaUri);

        const result: ScanResult = {
          ...res,
          // Use a synthetic URL for screenshots if none exists
          url: res.url || "screenshot://uploaded",
          domain: res.domain || "Screenshot",
          platform: res.platform || "other",
          title: res.title || "Uploaded screenshot",
          timestamp: res.timestamp || Date.now(),
        };

        await this.recordHistory(result);
        return result;
      } catch {
        // fall through
      }
    }

    // 2) Backend (optional)
    if (this.apiBaseUrl) {
      try {
        const form = new FormData();
        // RN FormData requires a file object for native; keep simple here
        // If you later implement backend media, you'll likely use expo-file-system to read and attach.
        form.append("advancedScan", String(!!request.advancedScan));

        const resp = await fetch(`${this.apiBaseUrl}/scan/media`, {
          method: "POST",
          body: form,
        });

        if (resp.ok) {
          const data = (await resp.json()) as ApiScanResponse;
          const result = this.mapApiResponse(data, "screenshot://uploaded");
          // enforce screenshot labeling
          result.domain = "Screenshot";
          result.title = "Uploaded screenshot";
          await this.recordHistory(result);
          return result;
        }
      } catch {
        // fall through
      }
    }

    // 3) Mock fallback for screenshot
    const mock = generateMockScan("screenshot://uploaded");
    const result: ScanResult = {
      ...mock,
      url: "screenshot://uploaded",
      domain: "Screenshot",
      platform: "other",
      title: "Uploaded screenshot",
      timestamp: mock.timestamp || Date.now(),
    };
    await this.recordHistory(result);
    return result;
  }

  async reportScam(req: ReportScamRequest): Promise<{ ok: boolean }> {
    // MVP: local-only (can be wired to backend later)
    // Never throw; never block UI
    try {
      if (!req.scanId) return { ok: false };
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}

/**
 * Keep compatibility for existing imports:
 * - `scanService.scanUrl({url})`
 * And also provide simple functions used by our scanning screen:
 * - `scanUrl(url)`
 * - `scanMedia(uri)`
 */
export const scanService = new ScanService();

export async function scanUrl(url: string, advancedScan?: boolean) {
  return scanService.scanUrl({ url, advancedScan });
}

export async function scanMedia(mediaUri: string, advancedScan?: boolean) {
  return scanService.scanMedia({ mediaUri, advancedScan });
}
