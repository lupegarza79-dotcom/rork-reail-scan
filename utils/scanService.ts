// utils/scanService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { aiScanEngine } from "./aiScanEngine";
import { generateMockScan, detectPlatform } from "./mockScan";
import { saveToHistory } from "./historyStore";
import { cacheScanResult } from "./scanCache";
import { postScanUrl } from "./api";

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

const SETTINGS_KEY = "reail_settings_v1";

type ReailSettings = {
  language?: "en" | "es";
  privacyMode?: boolean;
  saveHistory?: boolean;
  autoDelete?: "never" | "7" | "30";
  advancedScan?: boolean;
};

const DEFAULT_SETTINGS: Required<ReailSettings> = {
  language: "en",
  privacyMode: true,
  saveHistory: true,
  autoDelete: "never",
  advancedScan: false,
};

let _settingsCache: Required<ReailSettings> | null = null;
let _settingsCacheAt = 0;

async function getSettingsCached(): Promise<Required<ReailSettings>> {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheAt < 5000) return _settingsCache;

  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ReailSettings) : {};
    _settingsCache = { ...DEFAULT_SETTINGS, ...(parsed || {}) };
    _settingsCacheAt = now;
    return _settingsCache;
  } catch {
    _settingsCache = DEFAULT_SETTINGS;
    _settingsCacheAt = now;
    return _settingsCache;
  }
}

class ScanService {
  useAI = true;
  useMock = true;

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

  private async recordLocalStorage(result: ScanResult) {
    const settings = await getSettingsCached();

    if (!settings.saveHistory) return;

    const createdAt = new Date(result.timestamp || Date.now()).toISOString();
    const domain = result.domain || this.extractDomain(result.url);

    if (settings.privacyMode) {
      const minimal: any = {
        scanId: result.id,
        badge: result.badge,
        score: result.score,
        domain,
        createdAt,
      };

      await saveToHistory(minimal);

      if (result.id) {
        await cacheScanResult(result.id, {
          id: result.id,
          badge: result.badge,
          score: result.score,
          domain,
          platform: result.platform,
          timestamp: result.timestamp || Date.now(),
          reasons: result.reasons,
          url: "",
          title: undefined,
        });
      }
      return;
    }

    await saveToHistory({
      scanId: result.id,
      badge: result.badge,
      score: result.score,
      domain,
      title: result.title,
      url: result.url,
      createdAt,
      reasons: result.reasons,
    });

    if (result.id) {
      await cacheScanResult(result.id, result);
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
    const settings = await getSettingsCached();
    const url = this.normalizeUrl(request.url);
    const advanced = request.advancedScan ?? settings.advancedScan;

    if (this.useAI) {
      try {
        const res = await aiScanEngine.analyzeUrl(url);
        const result: ScanResult = {
          ...res,
          url: res.url || url,
          domain: res.domain || this.extractDomain(url),
          platform: res.platform || detectPlatform(url),
          timestamp: res.timestamp || Date.now(),
        };

        // Send to backend for canonical scanId (cross-device)
        try {
          const s = await getSettingsCached();
          const sendReasons = !s.privacyMode ? result.reasons : undefined;
          const server = await postScanUrl({
            url,
            score: result.score,
            reasons: sendReasons,
            title: !s.privacyMode ? result.title : undefined,
            entityType: "domain",
            entityKey: this.extractDomain(url),
          });
          if (server?.id) {
            result.id = server.id;
          }
        } catch {
          // never block scan if server fails
        }

        await this.recordLocalStorage(result);
        return result;
      } catch {
        // fall through
      }
    }

    if (this.apiBaseUrl) {
      try {
        const resp = await fetch(`${this.apiBaseUrl}/scan/url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, advancedScan: !!advanced }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as ApiScanResponse;
          const result = this.mapApiResponse(data, url);
          await this.recordLocalStorage(result);
          return result;
        }
      } catch {
        // fall through
      }
    }

    const mock = generateMockScan(url);
    const result: ScanResult = {
      ...mock,
      url,
      domain: mock.domain || this.extractDomain(url),
      platform: mock.platform || detectPlatform(url),
      timestamp: mock.timestamp || Date.now(),
    };

    await this.recordLocalStorage(result);
    return result;
  }

  async scanMedia(request: ScanMediaRequest): Promise<ScanResult> {
    const settings = await getSettingsCached();
    const mediaUri = (request.mediaUri || "").trim();
    const advanced = request.advancedScan ?? settings.advancedScan;

    if (this.useAI) {
      try {
        const res = await aiScanEngine.analyzeImage(mediaUri);

        const result: ScanResult = {
          ...res,
          url: res.url || "screenshot://uploaded",
          domain: res.domain || "Screenshot",
          platform: res.platform || "other",
          title: res.title || "Uploaded screenshot",
          timestamp: res.timestamp || Date.now(),
        };

        await this.recordLocalStorage(result);
        return result;
      } catch {
        // fall through
      }
    }

    if (this.apiBaseUrl) {
      try {
        const form = new FormData();
        form.append("advancedScan", String(!!advanced));

        const resp = await fetch(`${this.apiBaseUrl}/scan/media`, {
          method: "POST",
          body: form,
        });

        if (resp.ok) {
          const data = (await resp.json()) as ApiScanResponse;
          const result = this.mapApiResponse(data, "screenshot://uploaded");
          result.domain = "Screenshot";
          result.title = "Uploaded screenshot";
          await this.recordLocalStorage(result);
          return result;
        }
      } catch {
        // fall through
      }
    }

    const mock = generateMockScan("screenshot://uploaded");
    const result: ScanResult = {
      ...mock,
      url: "screenshot://uploaded",
      domain: "Screenshot",
      platform: "other",
      title: "Uploaded screenshot",
      timestamp: mock.timestamp || Date.now(),
    };

    await this.recordLocalStorage(result);
    return result;
  }

  async reportScam(req: ReportScamRequest): Promise<{ ok: boolean }> {
    try {
      if (!req.scanId) return { ok: false };
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}

export const scanService = new ScanService();

export async function scanUrl(url: string, advancedScan?: boolean) {
  return scanService.scanUrl({ url, advancedScan });
}

export async function scanMedia(mediaUri: string, advancedScan?: boolean) {
  return scanService.scanMedia({ mediaUri, advancedScan });
}
