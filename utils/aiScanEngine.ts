import { generateObject } from "@rork-ai/toolkit-sdk";
import { z } from "zod";
import { ScanResult, ScanReasons } from "@/types/scan";
import { File } from "expo-file-system";
import { Platform } from "react-native";

const ReasonDetailSchema = z.object({
  title: z.string().describe("Short title for this analysis category"),
  summary: z.string().describe("One-line summary of findings"),
  details: z.array(z.string()).describe("2-4 bullet points with specific findings"),
  suggestion: z.string().optional().describe("What would help verify or disprove this content"),
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
    
    try {
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
      console.error("[AIScanEngine] AI analysis failed:", error);
      throw error;
    }
  }

  async analyzeImage(imageUri: string): Promise<ScanResult> {
    console.log("[AIScanEngine] Analyzing image with AI:", imageUri);
    
    try {
      let imageData: string | null = null;
      
      if (Platform.OS !== "web") {
        try {
          const file = new File(imageUri);
          const base64 = await file.base64();
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
      console.error("[AIScanEngine] AI image analysis failed:", error);
      throw error;
    }
  }

  private buildUrlAnalysisPrompt(url: string): string {
    return `You are REAiL, an AI-powered reality verification engine. Analyze this URL/link for trust signals.

URL to analyze: ${url}

Analyze the following aspects and provide a comprehensive trust assessment:

1. **Media Integrity (A)**: Based on the URL/domain, assess likelihood of content manipulation, AI generation, or editing.

2. **Duplicate/Re-used Media (B)**: Consider if this type of content is commonly recycled or reposted from other sources.

3. **Claims vs Public Signals (C)**: Evaluate if the domain/platform is known for misinformation or verified journalism.

4. **Account Signals (D)**: Assess the credibility of the source/platform based on the URL structure and domain reputation.

5. **Link Safety (E)**: Check for suspicious URL patterns, unusual domains, potential phishing indicators, redirect chains, or malicious patterns.

6. **Patterns/Reports (F)**: Consider if this matches known scam patterns or frequently reported content types.

IMPORTANT RULES:
- Use risk-based language: "signals suggest", "likely", "appears to be" - NEVER claim absolute truth
- Be helpful but cautious - protect users from scams while not falsely accusing legitimate content
- Consider platform reputation: known platforms (YouTube, Instagram, major news sites) have baseline trust
- Unknown or suspicious domains should score lower
- Provide actionable suggestions for verification

Score Guidelines:
- 80-100 (VERIFIED): Legitimate platform, no red flags, consistent signals
- 50-79 (UNVERIFIED): Mixed signals, needs user caution, or unknown source
- 0-49 (HIGH_RISK): Multiple scam indicators, suspicious patterns, or known malicious signals`;
  }

  private buildImageAnalysisPrompt(): string {
    return `You are REAiL, an AI-powered reality verification engine. Analyze this uploaded screenshot/image for authenticity and trust signals.

Analyze the following aspects:

1. **Media Integrity (A)**: Look for editing artifacts, inconsistent lighting, AI generation markers, compression anomalies, or manipulation signs.

2. **Duplicate/Re-used Media (B)**: Assess if this appears to be original content or potentially recycled/stolen imagery.

3. **Claims vs Public Signals (C)**: If there's text in the image, evaluate claims for red flags or misinformation patterns.

4. **Account Signals (D)**: If the image shows social media content, assess the account/profile credibility signals.

5. **Link Safety (E)**: If URLs are visible in the image, assess them for suspicious patterns.

6. **Patterns/Reports (F)**: Check if this matches common scam formats (fake giveaways, phishing pages, too-good-to-be-true offers).

IMPORTANT RULES:
- Use risk-based language: "signals suggest", "likely", "appears to be" - NEVER claim absolute truth
- Look for specific visual indicators of manipulation or fraud
- Consider context clues visible in the image
- Provide specific, actionable verification suggestions

Score Guidelines:
- 80-100 (VERIFIED): No manipulation signs, appears authentic
- 50-79 (UNVERIFIED): Some uncertain elements, needs context
- 0-49 (HIGH_RISK): Clear manipulation signs or scam patterns visible`;
  }

  private mapAnalysisToResult(analysis: ScanAnalysis, originalUrl: string): ScanResult {
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

  private detectPlatform(url: string): ScanResult["platform"] {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("tiktok")) return "tiktok";
    if (lowerUrl.includes("instagram")) return "instagram";
    if (lowerUrl.includes("facebook") || lowerUrl.includes("fb.")) return "facebook";
    if (lowerUrl.includes("youtube") || lowerUrl.includes("youtu.be")) return "youtube";
    if (lowerUrl.includes("shop") || lowerUrl.includes("store") || lowerUrl.includes("amazon") || lowerUrl.includes("ebay")) return "shop";
    if (lowerUrl.includes("news") || lowerUrl.includes("bbc") || lowerUrl.includes("cnn")) return "news";
    return "other";
  }
}

export const aiScanEngine = AIScanEngine.getInstance();
