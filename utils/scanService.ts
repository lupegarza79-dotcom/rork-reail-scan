import { ScanResult, BadgeType, ScanReasons } from '@/types/scan';
import { generateMockScan } from './mockScan';

const API_BASE_URL = 'https://api.reail.app';
const API_TIMEOUT = 15000;

interface ScanUrlRequest {
  url: string;
  advancedScan?: boolean;
}

interface ScanMediaRequest {
  mediaUri: string;
  advancedScan?: boolean;
}

interface ReportScamRequest {
  scanId: string;
  category: string;
  notes?: string;
}

interface ApiScanResponse {
  scanId: string;
  badge: BadgeType;
  score: number;
  domain?: string;
  title?: string;
  thumbnail?: string;
  reasons: ScanReasons;
  shareCard: {
    headline: string;
    domain: string;
    badge: BadgeType;
    score: number;
    timestamp: number;
  };
  disclaimerKey: string;
}

class ScanService {
  private useMock = true;

  async scanUrl(request: ScanUrlRequest): Promise<ScanResult> {
    console.log('[ScanService] Scanning URL:', request.url);
    
    if (this.useMock) {
      console.log('[ScanService] Using mock scan engine');
      return this.mockScan(request.url);
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/scan/url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        console.log('[ScanService] API error, falling back to mock');
        return this.mockScan(request.url);
      }

      const data: ApiScanResponse = await response.json();
      return this.mapApiResponse(data, request.url);
    } catch (error) {
      console.log('[ScanService] Network error, falling back to mock:', error);
      return this.mockScan(request.url);
    }
  }

  async scanMedia(request: ScanMediaRequest): Promise<ScanResult> {
    console.log('[ScanService] Scanning media:', request.mediaUri);
    
    if (this.useMock) {
      console.log('[ScanService] Using mock scan engine for media');
      const result = this.mockScan('screenshot://uploaded');
      result.domain = 'Screenshot';
      result.platform = 'other';
      result.title = 'Uploaded screenshot';
      return result;
    }

    try {
      const formData = new FormData();
      formData.append('media', {
        uri: request.mediaUri,
        type: 'image/jpeg',
        name: 'screenshot.jpg',
      } as unknown as Blob);
      
      if (request.advancedScan) {
        formData.append('advancedScan', 'true');
      }

      const response = await this.fetchWithTimeout(`${API_BASE_URL}/scan/media`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.log('[ScanService] API error for media, falling back to mock');
        const result = this.mockScan('screenshot://uploaded');
        result.domain = 'Screenshot';
        result.platform = 'other';
        result.title = 'Uploaded screenshot';
        return result;
      }

      const data: ApiScanResponse = await response.json();
      return this.mapApiResponse(data, request.mediaUri);
    } catch (error) {
      console.log('[ScanService] Network error for media, falling back to mock:', error);
      const result = this.mockScan('screenshot://uploaded');
      result.domain = 'Screenshot';
      result.platform = 'other';
      result.title = 'Uploaded screenshot';
      return result;
    }
  }

  async reportScam(request: ReportScamRequest): Promise<boolean> {
    console.log('[ScanService] Reporting scam:', request);
    
    if (this.useMock) {
      console.log('[ScanService] Mock report submitted');
      return true;
    }

    try {
      const response = await this.fetchWithTimeout(`${API_BASE_URL}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      return response.ok;
    } catch (error) {
      console.log('[ScanService] Report error:', error);
      return false;
    }
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private mockScan(source: string): ScanResult {
    return generateMockScan(source);
  }

  private mapApiResponse(data: ApiScanResponse, originalUrl: string): ScanResult {
    return {
      id: data.scanId,
      url: originalUrl,
      domain: data.domain || this.extractDomain(originalUrl),
      platform: this.detectPlatform(originalUrl),
      badge: data.badge,
      score: data.score,
      reasons: data.reasons,
      timestamp: Date.now(),
      thumbnail: data.thumbnail,
      title: data.title,
    };
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  private detectPlatform(url: string): ScanResult['platform'] {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('tiktok')) return 'tiktok';
    if (lowerUrl.includes('instagram')) return 'instagram';
    if (lowerUrl.includes('facebook') || lowerUrl.includes('fb.')) return 'facebook';
    if (lowerUrl.includes('youtube') || lowerUrl.includes('youtu.be')) return 'youtube';
    if (lowerUrl.includes('shop') || lowerUrl.includes('store') || lowerUrl.includes('amazon') || lowerUrl.includes('ebay')) return 'shop';
    if (lowerUrl.includes('news') || lowerUrl.includes('bbc') || lowerUrl.includes('cnn')) return 'news';
    return 'other';
  }
}

export const scanService = new ScanService();
