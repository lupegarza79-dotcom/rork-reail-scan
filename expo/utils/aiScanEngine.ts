import { generateObject } from "@rork-ai/toolkit-sdk";
import { z } from "zod";
import { ScanResult, ScanReasons, ContentMetrics } from "@/types/scan";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

const SCAN_VERSION = "2.0.0";
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;

const ReasonDetailSchema = z.object({
  title: z.string().describe("Short title for this analysis category"),
  summary: z.string().describe("One-line summary of findings"),
  details: z.array(z.string()).describe("2-4 bullet points with specific findings"),
  suggestion: z.string().optional().describe("What would help verify or disprove this content"),
});

const ContentMetricsSchema = z.object({
  aiProbability: z.number().min(0).max(100).describe("Likelihood (0-100) the content is AI-generated based on patterns, artifacts, and metadata"),
  humanProbability: z.number().min(0).max(100).describe("Likelihood (0-100) the content is human-created and authentic"),
  authenticityScore: z.number().min(0).max(100).describe("Overall authenticity score considering all factors"),
  manipulationRisk: z.number().min(0).max(100).describe("Risk level (0-100) of content manipulation, editing, or doctoring"),
  scamIndicators: z.number().min(0).max(10).describe("Count of scam patterns detected (0-10)"),
  confidenceLevel: z.enum(["high", "medium", "low"]).describe("Confidence level of the analysis based on available signals"),
});

const ScanAnalysisSchema = z.object({
  badge: z.enum(["VERIFIED", "UNVERIFIED", "HIGH_RISK"]).describe(
    "VERIFIED (80-100 score): Content appears authentic with consistent signals. " +
    "UNVERIFIED (50-79 score): Not enough evidence, needs context. " +
    "HIGH_RISK (0-49 score): Multiple manipulation or scam signals detected."
  ),
  score: z.number().min(0).max(100).describe("Trust score from 0-100 based on analysis"),
  reasons: z.object({
    A: ReasonDetailSchema.describe("Media Integrity: Check for editing artifacts, AI generation markers, metadata inconsistencies"),
    B: ReasonDetailSchema.describe("Duplicate/Re-used Media: Check if content has been seen elsewhere, reverse image search signals"),
    C: ReasonDetailSchema.describe("Claims vs Public Signals: Verify claims against known facts, check for misinformation patterns"),
    D: ReasonDetailSchema.describe("Account Signals: Analyze source credibility, account age, posting patterns"),
    E: ReasonDetailSchema.describe("Link Safety: Check for suspicious domains, redirects, phishing patterns"),
    F: ReasonDetailSchema.describe("Patterns/Reports: Check for known scam patterns, similar reported content"),
  }),
  domain: z.string().describe("The domain or platform name"),
  title: z.string().describe("A short descriptive title for this scan result"),
  metrics: ContentMetricsSchema.describe("Detailed content metrics for AI/human detection and authenticity analysis"),
});

type ScanAnalysis = z.infer<typeof ScanAnalysisSchema>;

export class AIScanEngine {
  private static instance: AIScanEngine;

  static getInstance(): AIScanEngine {
    if (!AIScanEngine.instance) {
      AIScanEngine.instance = new AIScanEngine();
    }
    return AIScanEngine.instance;
  }

  async analyzeUrl(url: string): Promise<ScanResult> {
    console.log("[AIScanEngine] Analyzing URL with AI:", url);
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[AIScanEngine] Retry attempt ${attempt}/${MAX_RETRIES}`);
          await this.delay(RETRY_DELAY * attempt);
        }
        
        const analysis = await generateObject({
          messages: [
            {
              role: "user",
              content: this.buildUrlAnalysisPrompt(url),
            },
          ],
          schema: ScanAnalysisSchema,
        });

        console.log("[AIScanEngine] AI analysis complete:", analysis.badge, analysis.score);
        
        return this.mapAnalysisToResult(analysis, url);
      } catch (error) {
        lastError = error as Error;
        console.warn(`[AIScanEngine] AI analysis attempt ${attempt + 1} failed:`, error);
        
        if (this.isRetryableError(error)) {
          continue;
        }
        break;
      }
    }
    
    console.error("[AIScanEngine] All AI analysis attempts failed, using fallback:", lastError);
    return this.createFallbackResult(url);
  }

  async analyzeImage(imageUri: string): Promise<ScanResult> {
    console.log("[AIScanEngine] Analyzing image with AI:", imageUri);
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[AIScanEngine] Image retry attempt ${attempt}/${MAX_RETRIES}`);
          await this.delay(RETRY_DELAY * attempt);
        }
        
        let imageData: string | null = null;
        
        if (Platform.OS !== "web") {
          try {
            const base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: 'base64',
            });
            imageData = `data:image/jpeg;base64,${base64}`;
          } catch (e) {
            console.log("[AIScanEngine] Could not read image as base64:", e);
          }
        }

        const messages: { role: "user"; content: string | ({ type: "text"; text: string } | { type: "image"; image: string })[] }[] = [];
        
        if (imageData) {
          messages.push({
            role: "user",
            content: [
              { type: "text", text: this.buildImageAnalysisPrompt() },
              { type: "image", image: imageData },
            ],
          });
        } else {
          messages.push({
            role: "user",
            content: this.buildImageAnalysisPrompt() + "\n\n[Note: Image could not be processed directly. Analyze based on the request context.]",
          });
        }

        const analysis = await generateObject({
          messages,
          schema: ScanAnalysisSchema,
        });

        console.log("[AIScanEngine] AI image analysis complete:", analysis.badge, analysis.score);
        
        const result = this.mapAnalysisToResult(analysis, "screenshot://uploaded");
        result.domain = "Screenshot";
        result.platform = "other";
        
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[AIScanEngine] Image analysis attempt ${attempt + 1} failed:`, error);
        
        if (this.isRetryableError(error)) {
          continue;
        }
        break;
      }
    }
    
    console.error("[AIScanEngine] All image analysis attempts failed, using fallback:", lastError);
    return this.createFallbackImageResult();
  }

  private buildUrlAnalysisPrompt(url: string): string {
    return `You are REAiL, the world's most advanced AI-powered reality verification engine. Analyze this URL/link comprehensively.

URL to analyze: ${url}

Provide a thorough trust assessment covering:

1. **Media Integrity (A)**: Assess likelihood of content manipulation, AI generation, deepfakes, or editing artifacts.

2. **Duplicate/Re-used Media (B)**: Check if content is commonly recycled, stolen, or reposted from other sources.

3. **Claims vs Public Signals (C)**: Evaluate domain/platform reputation for misinformation vs verified journalism.

4. **Account Signals (D)**: Assess source credibility based on URL structure, domain age, and reputation signals.

5. **Link Safety (E)**: Check for suspicious URL patterns, unusual TLDs, phishing indicators, redirect chains, URL shorteners masking destinations, or malicious patterns.

6. **Patterns/Reports (F)**: Match against known scam patterns including:
   - Crypto/investment scams
   - Fake giveaways
   - Romance/dating scams
   - Tech support scams
   - Phishing attempts
   - Impersonation schemes
   - Too-good-to-be-true offers

**CONTENT METRICS REQUIRED:**
- aiProbability: Estimate % likelihood content at this URL is AI-generated
- humanProbability: Estimate % likelihood content is human-created (should roughly complement aiProbability)
- authenticityScore: Overall authenticity considering source reputation and content type
- manipulationRisk: Risk of manipulated/doctored content
- scamIndicators: Count specific scam patterns (0-10)
- confidenceLevel: Your confidence in this analysis (high/medium/low based on available signals)

**CRITICAL RULES:**
- Use risk-based language: "signals suggest", "likely", "appears to be" - NEVER claim absolute truth
- Known platforms (YouTube, Instagram, TikTok, major news) have baseline trust but content can still be fake
- Unknown domains, newly registered domains, or suspicious TLDs should score lower
- URL shorteners (bit.ly, tinyurl, etc.) add uncertainty
- Check for typosquatting (e.g., facebo0k.com, amaz0n.com)
- Crypto/NFT links need extra scrutiny

**Score Guidelines:**
- 80-100 (VERIFIED): Legitimate platform, no red flags, consistent signals
- 50-79 (UNVERIFIED): Mixed signals, needs user caution, or unknown source
- 0-49 (HIGH_RISK): Multiple scam indicators, suspicious patterns, or known malicious signals`;
  }

  private buildImageAnalysisPrompt(): string {
    return `You are REAiL, the world's most advanced AI-powered reality verification engine. Analyze this uploaded screenshot/image comprehensively.

Provide thorough analysis of:

1. **Media Integrity (A)**: Look for:
   - AI generation artifacts (unnatural hands, text, backgrounds)
   - Deepfake indicators (face inconsistencies, unnatural blinking patterns)
   - Editing artifacts (clone stamp patterns, inconsistent lighting/shadows)
   - Compression anomalies suggesting manipulation
   - Metadata inconsistencies

2. **Duplicate/Re-used Media (B)**: Assess if content appears original or potentially recycled/stolen.

3. **Claims vs Public Signals (C)**: Evaluate any text/claims for:
   - Misinformation patterns
   - Sensationalist language
   - Unverifiable claims
   - Emotional manipulation tactics

4. **Account Signals (D)**: If showing social media, check:
   - Verification badges (real vs fake)
   - Account age indicators
   - Follower count anomalies
   - Bot-like patterns

5. **Link Safety (E)**: For any visible URLs:
   - Suspicious domain patterns
   - Typosquatting attempts
   - URL shortener masking

6. **Patterns/Reports (F)**: Match against scam formats:
   - Fake celebrity endorsements
   - "I just won" scams
   - Crypto/investment schemes
   - Fake product reviews
   - Impersonation attempts
   - Urgency/fear tactics

**CONTENT METRICS REQUIRED:**
- aiProbability: % likelihood this image/content is AI-generated (check for AI art styles, deepfake signs)
- humanProbability: % likelihood this is authentic human-created content
- authenticityScore: Overall authenticity score
- manipulationRisk: Risk of edited/doctored content
- scamIndicators: Count of detected scam patterns (0-10)
- confidenceLevel: Your confidence level (high/medium/low)

**CRITICAL RULES:**
- Use risk-based language - NEVER claim absolute truth
- Look for specific visual indicators of AI generation or manipulation
- Consider context clues visible in the image
- Provide specific, actionable verification suggestions

**Score Guidelines:**
- 80-100 (VERIFIED): No manipulation signs, appears authentic
- 50-79 (UNVERIFIED): Uncertain elements, needs context
- 0-49 (HIGH_RISK): Clear manipulation or scam patterns`;
  }

  private mapAnalysisToResult(analysis: ScanAnalysis, originalUrl: string): ScanResult {
    const metrics: ContentMetrics = analysis.metrics ? {
      aiProbability: Math.max(0, Math.min(100, analysis.metrics.aiProbability)),
      humanProbability: Math.max(0, Math.min(100, analysis.metrics.humanProbability)),
      authenticityScore: Math.max(0, Math.min(100, analysis.metrics.authenticityScore)),
      manipulationRisk: Math.max(0, Math.min(100, analysis.metrics.manipulationRisk)),
      scamIndicators: Math.max(0, Math.min(10, analysis.metrics.scamIndicators)),
      confidenceLevel: analysis.metrics.confidenceLevel,
    } : {
      aiProbability: 50,
      humanProbability: 50,
      authenticityScore: analysis.score,
      manipulationRisk: 100 - analysis.score,
      scamIndicators: analysis.badge === 'HIGH_RISK' ? 3 : analysis.badge === 'UNVERIFIED' ? 1 : 0,
      confidenceLevel: 'medium',
    };

    return {
      id: this.generateId(),
      url: originalUrl,
      domain: analysis.domain || this.extractDomain(originalUrl),
      platform: this.detectPlatform(originalUrl),
      badge: analysis.badge,
      score: analysis.score,
      reasons: analysis.reasons as ScanReasons,
      timestamp: Date.now(),
      title: analysis.title,
      metrics,
      scanVersion: SCAN_VERSION,
    };
  }

  private generateId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractDomain(url: string): string {
    try {
      if (url.startsWith("screenshot://")) return "Screenshot";
      const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "unknown";
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof TypeError && String(error).includes('Failed to fetch')) {
      return true;
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') || 
             message.includes('timeout') || 
             message.includes('fetch') ||
             message.includes('connection');
    }
    return false;
  }

  private createFallbackResult(url: string): ScanResult {
    console.log("[AIScanEngine] Creating fallback result for:", url);
    const domain = this.extractDomain(url);
    const platform = this.detectPlatform(url);
    
    const isTrustedPlatform = ['youtube', 'instagram', 'facebook', 'twitter', 'linkedin', 'reddit', 'news'].includes(platform);
    const score = isTrustedPlatform ? 60 : 50;
    const badge = score >= 50 ? 'UNVERIFIED' : 'HIGH_RISK';
    
    return {
      id: this.generateId(),
      url,
      domain,
      platform,
      badge: badge as 'VERIFIED' | 'UNVERIFIED' | 'HIGH_RISK',
      score,
      reasons: {
        A: {
          title: "Media Integrity",
          summary: "Analysis unavailable - service temporarily offline",
          details: ["AI analysis service could not be reached", "Manual verification recommended", "Check content source directly"],
          suggestion: "Try scanning again in a few moments",
        },
        B: {
          title: "Duplicate Detection",
          summary: "Unable to check for duplicate content",
          details: ["Reverse image search not performed", "Content origin unverified"],
          suggestion: "Use reverse image search tools manually",
        },
        C: {
          title: "Claims Analysis",
          summary: "Claims could not be verified",
          details: ["Fact-checking service unavailable", "Cross-reference claims independently"],
          suggestion: "Check multiple trusted sources",
        },
        D: {
          title: "Account Signals",
          summary: isTrustedPlatform ? "Known platform detected" : "Platform credibility unknown",
          details: isTrustedPlatform 
            ? ["Content is from a recognized platform", "Individual content verification still needed"]
            : ["Unknown or unrecognized platform", "Exercise additional caution"],
          suggestion: "Verify account authenticity manually",
        },
        E: {
          title: "Link Safety",
          summary: "Basic link analysis only",
          details: [`Domain: ${domain}`, "Full security scan unavailable", "Proceed with standard caution"],
          suggestion: "Verify URL before clicking any links",
        },
        F: {
          title: "Pattern Analysis",
          summary: "Scam pattern detection unavailable",
          details: ["Pattern matching service offline", "Watch for common scam indicators"],
          suggestion: "Be wary of too-good-to-be-true offers",
        },
      },
      timestamp: Date.now(),
      title: `Scan of ${domain} (Limited Analysis)`,
      metrics: {
        aiProbability: 50,
        humanProbability: 50,
        authenticityScore: score,
        manipulationRisk: 50,
        scamIndicators: 0,
        confidenceLevel: 'low',
      },
      scanVersion: SCAN_VERSION,
    };
  }

  private createFallbackImageResult(): ScanResult {
    console.log("[AIScanEngine] Creating fallback image result");
    
    return {
      id: this.generateId(),
      url: "screenshot://uploaded",
      domain: "Screenshot",
      platform: "other",
      badge: 'UNVERIFIED',
      score: 50,
      reasons: {
        A: {
          title: "Media Integrity",
          summary: "Image analysis service temporarily unavailable",
          details: ["AI analysis could not be completed", "Manual review recommended", "Check for visible manipulation signs"],
          suggestion: "Try scanning again or verify content manually",
        },
        B: {
          title: "Duplicate Detection",
          summary: "Unable to check for duplicate images",
          details: ["Reverse image search not performed"],
          suggestion: "Use Google Images or TinEye for reverse search",
        },
        C: {
          title: "Claims Analysis",
          summary: "Text/claims in image not analyzed",
          details: ["OCR analysis unavailable", "Verify any visible claims independently"],
          suggestion: "Fact-check any text visible in the image",
        },
        D: {
          title: "Account Signals",
          summary: "Source account not analyzed",
          details: ["Cannot determine original source", "Check where this image was shared"],
          suggestion: "Verify the account sharing this content",
        },
        E: {
          title: "Link Safety",
          summary: "No links detected in image",
          details: ["Image content only"],
          suggestion: "Be cautious of any URLs shown in images",
        },
        F: {
          title: "Pattern Analysis",
          summary: "Scam pattern detection unavailable",
          details: ["Pattern matching service offline"],
          suggestion: "Watch for common visual scam formats",
        },
      },
      timestamp: Date.now(),
      title: "Screenshot Analysis (Limited)",
      metrics: {
        aiProbability: 50,
        humanProbability: 50,
        authenticityScore: 50,
        manipulationRisk: 50,
        scamIndicators: 0,
        confidenceLevel: 'low',
      },
      scanVersion: SCAN_VERSION,
    };
  }

  private detectPlatform(url: string): ScanResult["platform"] {
    const lowerUrl = url.toLowerCase();
    
    // Social media platforms
    if (lowerUrl.includes("tiktok") || lowerUrl.includes("vm.tiktok")) return "tiktok";
    if (lowerUrl.includes("instagram") || lowerUrl.includes("instagr.am")) return "instagram";
    if (lowerUrl.includes("facebook") || lowerUrl.includes("fb.com") || lowerUrl.includes("fb.watch") || lowerUrl.includes("m.facebook")) return "facebook";
    if (lowerUrl.includes("youtube") || lowerUrl.includes("youtu.be") || lowerUrl.includes("yt.be")) return "youtube";
    if (lowerUrl.includes("twitter") || lowerUrl.includes("x.com") || lowerUrl.includes("t.co")) return "twitter";
    if (lowerUrl.includes("linkedin")) return "linkedin";
    if (lowerUrl.includes("reddit") || lowerUrl.includes("redd.it")) return "reddit";
    
    // Crypto platforms (high risk category)
    if (lowerUrl.includes("crypto") || lowerUrl.includes("bitcoin") || lowerUrl.includes("eth") || 
        lowerUrl.includes("nft") || lowerUrl.includes("opensea") || lowerUrl.includes("binance") ||
        lowerUrl.includes("coinbase") || lowerUrl.includes("metamask") || lowerUrl.includes("uniswap")) return "crypto";
    
    // Shopping platforms
    if (lowerUrl.includes("shop") || lowerUrl.includes("store") || lowerUrl.includes("amazon") || 
        lowerUrl.includes("ebay") || lowerUrl.includes("etsy") || lowerUrl.includes("aliexpress") ||
        lowerUrl.includes("wish.com") || lowerUrl.includes("shopify") || lowerUrl.includes("walmart")) return "shop";
    
    // News sources
    if (lowerUrl.includes("news") || lowerUrl.includes("bbc") || lowerUrl.includes("cnn") ||
        lowerUrl.includes("reuters") || lowerUrl.includes("ap.org") || lowerUrl.includes("nytimes") ||
        lowerUrl.includes("guardian") || lowerUrl.includes("washingtonpost") || lowerUrl.includes("foxnews")) return "news";
    
    return "other";
  }
}

export const aiScanEngine = AIScanEngine.getInstance();
