// utils/scanService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { aiScanEngine } from "./aiScanEngine";
import { generateMockScan, detectPlatform } from "./mockScan";
import { saveToHistory } from "./historyStore";
import { trackEvent } from "./analytics";
import { cacheScanResult } from "./scanCache";
import { postScanUrl, contentScan, quickScan as quickScanApi } from "./api";
import { calculateScoreFromEvidence, PLACEHOLDER_EVIDENCE } from "./evidenceEngine";

import type { ScanResult, BadgeType, ScanReasons, EvidenceCard } from "@/types/scan";

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
  evidence?: EvidenceCard[];
  summary?: string;
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

    // Try quick-scan GET first (fast verdict)
    try {
      console.log("[ScanService] Trying quick-scan GET for:", url);
      const qr = await quickScanApi(url);

      if (qr && qr.scan_id && qr.badge) {
        console.log("[ScanService] quick-scan ok:", qr.badge, qr.score);
        trackEvent('quick_scan_success', { badge: qr.badge, score: qr.score ?? 0 });

        const reasons = this.buildReasonsFromRedFlags(qr.top_red_flags || []);
        const result: ScanResult = {
          id: qr.scan_id,
          url,
          domain: qr.domain || this.extractDomain(url),
          platform: detectPlatform(url),
          badge: qr.badge as BadgeType,
          score: qr.score ?? 50,
          reasons,
          timestamp: Date.now(),
        };

        await this.recordLocalStorage(result);
        return result;
      }
    } catch (err) {
      console.log("[ScanService] quick-scan failed, trying content-scan:", err);
    }

    // Try content-scan POST for full Evidence Pack
    try {
      console.log("[ScanService] Trying content-scan for:", url);
      const contentResult = await contentScan(url);
      
      if (contentResult && contentResult.evidence?.length) {
        console.log("[ScanService] Got real evidence pack:", contentResult.evidence.length, "cards");
        
        const breakdown = contentResult.scoreBreakdown || calculateScoreFromEvidence(contentResult.evidence);
        
        const result: ScanResult = {
          id: contentResult.scanId,
          url,
          finalUrl: contentResult.finalUrl,
          domain: contentResult.domain || this.extractDomain(url),
          platform: detectPlatform(url),
          badge: contentResult.badge || breakdown.badge,
          score: contentResult.score || breakdown.finalScore,
          reasons: this.buildReasonsFromEvidence(contentResult.evidence),
          timestamp: Date.now(),
          evidence: contentResult.evidence,
          summary: contentResult.summary,
          scoreBreakdown: breakdown,
        };

        await this.recordLocalStorage(result);
        return result;
      }
    } catch (err) {
      console.log("[ScanService] content-scan failed, falling back:", err);
    }

    if (this.useAI) {
      try {
        const res = await aiScanEngine.analyzeUrl(url);
        const result: ScanResult = {
          ...res,
          url: res.url || url,
          domain: res.domain || this.extractDomain(url),
          platform: res.platform || detectPlatform(url),
          timestamp: res.timestamp || Date.now(),
          evidence: PLACEHOLDER_EVIDENCE,
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

    console.log('[ScanService] All providers failed, using mock fallback');
    trackEvent('fallback_used', { input: url.substring(0, 60) });

    const mock = generateMockScan(url);
    const result: ScanResult = {
      ...mock,
      url,
      domain: mock.domain || this.extractDomain(url),
      platform: mock.platform || detectPlatform(url),
      timestamp: mock.timestamp || Date.now(),
      evidence: PLACEHOLDER_EVIDENCE,
      isMock: true,
    };

    await this.recordLocalStorage(result);
    return result;
  }

  private buildReasonsFromEvidence(evidence: EvidenceCard[]): ScanReasons {
    const reasons: ScanReasons = {
      A: { title: "Media Integrity", summary: "No media analysis available.", details: [] },
      B: { title: "Duplicate / Re-used Media", summary: "No duplicate check performed.", details: [] },
      C: { title: "Claims vs Public Signals", summary: "Claims not analyzed.", details: [] },
      D: { title: "Account Signals", summary: "Account not analyzed.", details: [] },
      E: { title: "Link Safety", summary: "Link analysis pending.", details: [] },
      F: { title: "Patterns / Reports", summary: "Pattern matching pending.", details: [] },
    };

    for (const card of evidence) {
      if (card.status === 'pending') continue;

      switch (card.provider) {
        case 'link_intel':
          reasons.E = {
            title: "Link Safety",
            summary: card.summary,
            details: this.extractDetails(card),
          };
          break;
        case 'domain_intel':
          reasons.E = {
            ...reasons.E,
            summary: reasons.E.summary + " " + card.summary,
            details: [...(reasons.E.details || []), ...this.extractDetails(card)],
          };
          break;
        case 'social_context':
          reasons.D = {
            title: "Account Signals",
            summary: card.summary,
            details: this.extractDetails(card),
          };
          break;
        case 'pattern_match':
          reasons.F = {
            title: "Patterns / Reports",
            summary: card.summary,
            details: this.extractDetails(card),
          };
          break;
      }
    }

    return reasons;
  }

  private buildReasonsFromRedFlags(flags: string[]): ScanReasons {
    const reasons: ScanReasons = {
      A: { title: "Media Integrity", summary: "No media analysis available.", details: [] },
      B: { title: "Duplicate / Re-used Media", summary: "No duplicate check performed.", details: [] },
      C: { title: "Claims vs Public Signals", summary: "Claims not analyzed.", details: [] },
      D: { title: "Account Signals", summary: "Account not analyzed.", details: [] },
      E: { title: "Link Safety", summary: "Link analysis pending.", details: [] },
      F: { title: "Patterns / Reports", summary: "Pattern matching pending.", details: [] },
    };

    if (flags.length > 0) {
      reasons.F = {
        title: "Patterns / Reports",
        summary: flags[0] || "Signals detected.",
        details: flags,
      };
    }

    return reasons;
  }

  private extractDetails(card: EvidenceCard): string[] {
    const details: string[] = [];
    if (!card.payload) return details;

    const p = card.payload as Record<string, unknown>;
    
    if (p.redirectCount !== undefined) details.push(`Redirect count: ${p.redirectCount}`);
    if (p.hasDoubleHop) details.push("Double-hop redirect detected");
    if (p.domainAgeDays !== undefined) details.push(`Domain age: ${p.domainAgeDays} days`);
    if (p.isPunycode) details.push("⚠️ Punycode domain detected");
    if (p.isLookalike) details.push(`⚠️ Lookalike domain (similar to ${p.lookalikeTo})`);
    if (p.phishingScore !== undefined) details.push(`Phishing score: ${p.phishingScore}/100`);
    if (p.knownScamMatch) details.push("⚠️ Known scam URL match");
    if (p.matchedPatterns && Array.isArray(p.matchedPatterns) && p.matchedPatterns.length > 0) {
      details.push(`Matched patterns: ${(p.matchedPatterns as string[]).join(", ")}`);
    }

    return details;
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

    console.log('[ScanService] Media scan: all providers failed, using mock fallback');
    trackEvent('fallback_used', { input: 'screenshot' });

    const mock = generateMockScan("screenshot://uploaded");
    const result: ScanResult = {
      ...mock,
      url: "screenshot://uploaded",
      domain: "Screenshot",
      platform: "other",
      title: "Uploaded screenshot",
      timestamp: mock.timestamp || Date.now(),
      isMock: true,
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
