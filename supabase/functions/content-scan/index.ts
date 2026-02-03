// Supabase Edge Function: content-scan
// POST /scan/content - Performs Link Intel + Domain Intel analysis
// Returns: { scan_id, badge, score, summary, evidence[] }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BadgeType = "VERIFIED" | "UNVERIFIED" | "HIGH_RISK";
type EvidenceStatus = "pass" | "warn" | "fail";
type EvidenceProvider = "link_intel" | "domain_intel" | "social_context" | "pattern_match";

interface EvidenceItem {
  provider: EvidenceProvider;
  provider_label: string;
  status: EvidenceStatus;
  summary: string;
  weight: number;
  score_impact: number;
  payload: Record<string, unknown>;
}

interface LinkIntelPayload {
  originalUrl: string;
  finalUrl: string;
  redirectChain: string[];
  redirectCount: number;
  hasDoubleHop: boolean;
  trackingParams: string[];
  shortlinkExpanded: boolean;
  suspiciousRedirect: boolean;
}

interface DomainIntelPayload {
  domain: string;
  domainAgeDays: number | null;
  registrar: string | null;
  createdDate: string | null;
  expiresDate: string | null;
  isPunycode: boolean;
  isLookalike: boolean;
  lookalikeTo: string | null;
  suspiciousTld: boolean;
  tld: string;
  hasMxRecords: boolean | null;
  asnRisk: "low" | "medium" | "high";
  hostingProvider: string | null;
}

const SHORTLINK_DOMAINS = [
  "bit.ly", "t.co", "goo.gl", "tinyurl.com", "ow.ly", "is.gd", 
  "buff.ly", "adf.ly", "j.mp", "tr.im", "cli.gs", "short.to",
  "budurl.com", "ping.fm", "post.ly", "Just.as", "bkite.com",
  "snipr.com", "fic.kr", "loopt.us", "doiop.com", "short.ie",
  "kl.am", "wp.me", "rubyurl.com", "om.ly", "to.ly", "bit.do",
  "lnkd.in", "db.tt", "qr.ae", "adf.ly", "bitly.com", "cur.lv",
  "ity.im", "q.gs", "po.st", "bc.vc", "twitthis.com", "u.telemail.io",
  "rebrand.ly", "bl.ink", "tiny.cc", "shorturl.at", "rb.gy"
];

const SUSPICIOUS_TLDS = [
  "xyz", "top", "work", "click", "link", "surf", "gdn", "date",
  "download", "stream", "racing", "win", "bid", "loan", "trade",
  "party", "science", "cricket", "faith", "review", "accountant",
  "tk", "ml", "ga", "cf", "gq", "pw", "cc", "buzz", "casa"
];

const LOOKALIKE_BRANDS: Record<string, string[]> = {
  "google": ["g00gle", "googie", "gooogle", "googl3", "go0gle"],
  "facebook": ["faceb00k", "facebok", "facbook", "faceboook"],
  "amazon": ["amaz0n", "arnazon", "amazom", "amazonn"],
  "apple": ["app1e", "appie", "applle"],
  "paypal": ["paypa1", "paypai", "paypaI", "pаypal"],
  "microsoft": ["micr0soft", "mircosoft", "microsofl"],
  "instagram": ["1nstagram", "instagran", "lnstagram"],
  "netflix": ["netfIix", "netfl1x", "neflix"],
  "bank": ["banc", "bonk", "baank"],
};

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.split("/")[0].replace(/^www\./, "");
  }
}

function isPunycode(domain: string): boolean {
  return domain.includes("xn--");
}

function checkLookalike(domain: string): { isLookalike: boolean; lookalikeTo: string | null } {
  const domainLower = domain.toLowerCase();
  const baseDomain = domainLower.split(".")[0];
  
  for (const [brand, variants] of Object.entries(LOOKALIKE_BRANDS)) {
    if (variants.some(v => baseDomain.includes(v))) {
      return { isLookalike: true, lookalikeTo: brand };
    }
    if (baseDomain.includes(brand) && baseDomain !== brand) {
      const suffixes = ["-login", "-secure", "-verify", "-account", "-support"];
      if (suffixes.some(s => baseDomain.includes(s))) {
        return { isLookalike: true, lookalikeTo: brand };
      }
    }
  }
  return { isLookalike: false, lookalikeTo: null };
}

function getTld(domain: string): string {
  const parts = domain.split(".");
  return parts[parts.length - 1];
}

function extractTrackingParams(url: string): string[] {
  const trackingPrefixes = [
    "utm_", "fbclid", "gclid", "msclkid", "ref", "affiliate",
    "aff_", "campaign", "source", "medium", "clickid", "trk",
    "tracking", "promo", "discount", "deal"
  ];
  
  try {
    const parsed = new URL(url);
    const params: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (trackingPrefixes.some(p => key.toLowerCase().startsWith(p))) {
        params.push(key);
      }
    });
    return params;
  } catch {
    return [];
  }
}

async function followRedirects(url: string): Promise<{
  finalUrl: string;
  chain: string[];
  hasDoubleHop: boolean;
  shortlinkExpanded: boolean;
}> {
  const chain: string[] = [url];
  let currentUrl = url;
  let hasDoubleHop = false;
  let shortlinkExpanded = false;
  const initialDomain = extractDomain(url);
  
  const isShortlink = SHORTLINK_DOMAINS.some(d => initialDomain.includes(d));
  if (isShortlink) shortlinkExpanded = true;
  
  for (let i = 0; i < 10; i++) {
    try {
      const resp = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        headers: { "User-Agent": "ReailBot/2.0" },
      });
      
      const location = resp.headers.get("location");
      if (!location || resp.status < 300 || resp.status >= 400) break;
      
      const nextUrl = location.startsWith("http") 
        ? location 
        : new URL(location, currentUrl).toString();
      
      chain.push(nextUrl);
      
      const prevDomain = extractDomain(currentUrl);
      const nextDomain = extractDomain(nextUrl);
      
      if (prevDomain !== nextDomain && 
          SHORTLINK_DOMAINS.some(d => nextDomain.includes(d))) {
        hasDoubleHop = true;
      }
      
      currentUrl = nextUrl;
    } catch {
      break;
    }
  }
  
  return {
    finalUrl: currentUrl,
    chain,
    hasDoubleHop,
    shortlinkExpanded,
  };
}

async function analyzeLinkIntel(url: string): Promise<EvidenceItem> {
  console.log("[LinkIntel] Analyzing:", url);
  
  const { finalUrl, chain, hasDoubleHop, shortlinkExpanded } = await followRedirects(url);
  const trackingParams = extractTrackingParams(finalUrl);
  
  const suspiciousRedirect = hasDoubleHop || 
    chain.length > 5 ||
    (shortlinkExpanded && chain.some(u => {
      const d = extractDomain(u);
      return SUSPICIOUS_TLDS.includes(getTld(d));
    }));
  
  const payload: LinkIntelPayload = {
    originalUrl: url,
    finalUrl,
    redirectChain: chain,
    redirectCount: chain.length - 1,
    hasDoubleHop,
    trackingParams,
    shortlinkExpanded,
    suspiciousRedirect,
  };
  
  let status: EvidenceStatus = "pass";
  let summary = "URL passed link analysis";
  let scoreImpact = 5;
  
  if (suspiciousRedirect) {
    status = "fail";
    summary = "Suspicious redirect pattern detected";
    scoreImpact = -25;
  } else if (hasDoubleHop) {
    status = "warn";
    summary = "Double-hop redirect detected";
    scoreImpact = -15;
  } else if (chain.length > 3) {
    status = "warn";
    summary = `${chain.length - 1} redirects detected`;
    scoreImpact = -5;
  } else if (trackingParams.length > 5) {
    status = "warn";
    summary = "Excessive tracking parameters";
    scoreImpact = -5;
  }
  
  console.log("[LinkIntel] Result:", { status, summary, scoreImpact });
  
  return {
    provider: "link_intel",
    provider_label: "Link Intel",
    status,
    summary,
    weight: 25,
    score_impact: scoreImpact,
    payload,
  };
}

async function analyzeDomainIntel(url: string): Promise<EvidenceItem> {
  const domain = extractDomain(url);
  console.log("[DomainIntel] Analyzing:", domain);
  
  const tld = getTld(domain);
  const isPunycodeResult = isPunycode(domain);
  const lookalike = checkLookalike(domain);
  const suspiciousTld = SUSPICIOUS_TLDS.includes(tld);
  
  let domainAgeDays: number | null = null;
  let registrar: string | null = null;
  let createdDate: string | null = null;
  let expiresDate: string | null = null;
  let hasMxRecords: boolean | null = null;
  let asnRisk: "low" | "medium" | "high" = "low";
  let hostingProvider: string | null = null;
  
  try {
    const whoisResp = await fetch(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${Deno.env.get("WHOIS_API_KEY")}&domainName=${domain}&outputFormat=JSON`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (whoisResp.ok) {
      const whoisData = await whoisResp.json();
      const record = whoisData?.WhoisRecord;
      
      if (record?.createdDate) {
        createdDate = record.createdDate;
        const created = new Date(record.createdDate);
        domainAgeDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      if (record?.expiresDate) {
        expiresDate = record.expiresDate;
      }
      
      if (record?.registrarName) {
        registrar = record.registrarName;
      }
    }
  } catch (e) {
    console.log("[DomainIntel] WHOIS lookup failed:", e);
  }
  
  try {
    const dnsResp = await fetch(
      `https://dns.google/resolve?name=${domain}&type=MX`,
      { signal: AbortSignal.timeout(3000) }
    );
    
    if (dnsResp.ok) {
      const dnsData = await dnsResp.json();
      hasMxRecords = (dnsData?.Answer?.length ?? 0) > 0;
    }
  } catch {
    console.log("[DomainIntel] DNS MX lookup failed");
  }
  
  const payload: DomainIntelPayload = {
    domain,
    domainAgeDays,
    registrar,
    createdDate,
    expiresDate,
    isPunycode: isPunycodeResult,
    isLookalike: lookalike.isLookalike,
    lookalikeTo: lookalike.lookalikeTo,
    suspiciousTld,
    tld,
    hasMxRecords,
    asnRisk,
    hostingProvider,
  };
  
  let status: EvidenceStatus = "pass";
  let summary = "Domain passed verification";
  let scoreImpact = 5;
  
  if (isPunycodeResult || lookalike.isLookalike) {
    status = "fail";
    summary = lookalike.isLookalike 
      ? `Lookalike domain detected (similar to ${lookalike.lookalikeTo})`
      : "Punycode domain detected - possible spoofing";
    scoreImpact = -30;
  } else if (domainAgeDays !== null && domainAgeDays < 7) {
    status = "fail";
    summary = `Domain is only ${domainAgeDays} days old`;
    scoreImpact = -25;
  } else if (domainAgeDays !== null && domainAgeDays < 30) {
    status = "warn";
    summary = `Domain is ${domainAgeDays} days old`;
    scoreImpact = -15;
  } else if (suspiciousTld) {
    status = "warn";
    summary = `Suspicious TLD (.${tld})`;
    scoreImpact = -10;
  } else if (hasMxRecords === false) {
    status = "warn";
    summary = "No MX records found";
    scoreImpact = -5;
  }
  
  console.log("[DomainIntel] Result:", { status, summary, scoreImpact });
  
  return {
    provider: "domain_intel",
    provider_label: "Domain Intel",
    status,
    summary,
    weight: 30,
    score_impact: scoreImpact,
    payload,
  };
}

function calculateScore(evidence: EvidenceItem[]): { score: number; badge: BadgeType } {
  const BASE_SCORE = 70;
  const totalImpact = evidence.reduce((sum, e) => sum + e.score_impact, 0);
  const rawScore = BASE_SCORE + totalImpact;
  const score = Math.max(0, Math.min(100, rawScore));
  
  const hasCriticalFail = evidence.some(e => 
    e.status === "fail" && e.score_impact <= -25
  );
  
  let badge: BadgeType;
  if (hasCriticalFail || score < 50) {
    badge = "HIGH_RISK";
  } else if (score >= 80 && !evidence.some(e => e.status === "fail")) {
    badge = "VERIFIED";
  } else {
    badge = "UNVERIFIED";
  }
  
  return { score, badge };
}

function generateSummary(badge: BadgeType, evidence: EvidenceItem[], domain: string): string {
  const failedChecks = evidence.filter(e => e.status === "fail");
  const warnChecks = evidence.filter(e => e.status === "warn");
  
  if (badge === "HIGH_RISK") {
    if (failedChecks.length > 0) {
      return `High risk detected: ${failedChecks.map(e => e.summary).join(". ")}`;
    }
    return `High risk indicators found for ${domain}`;
  }
  
  if (badge === "VERIFIED") {
    return `${domain} passed all verification checks`;
  }
  
  if (warnChecks.length > 0) {
    return `Some concerns found: ${warnChecks.map(e => e.summary).join(". ")}`;
  }
  
  return `Unable to fully verify ${domain}. Exercise caution.`;
}

function detectPlatform(url: string): string {
  const domain = extractDomain(url).toLowerCase();
  
  if (domain.includes("tiktok")) return "tiktok";
  if (domain.includes("instagram")) return "instagram";
  if (domain.includes("facebook") || domain.includes("fb.")) return "facebook";
  if (domain.includes("youtube") || domain.includes("youtu.be")) return "youtube";
  if (domain.includes("twitter") || domain.includes("x.com")) return "twitter";
  if (domain.includes("linkedin")) return "linkedin";
  if (domain.includes("reddit")) return "reddit";
  
  return "other";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  try {
    const deviceId = req.headers.get("x-device-id") || "anonymous";
    const { url } = await req.json();
    
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("[content-scan] Starting scan for:", url, "device:", deviceId);
    
    const [linkIntel, domainIntel] = await Promise.all([
      analyzeLinkIntel(url),
      analyzeDomainIntel(url),
    ]);
    
    const evidence: EvidenceItem[] = [linkIntel, domainIntel];
    const { score, badge } = calculateScore(evidence);
    const domain = extractDomain(linkIntel.payload.finalUrl as string || url);
    const summary = generateSummary(badge, evidence, domain);
    const platform = detectPlatform(url);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const scoreBreakdown = {
      baseScore: 70,
      adjustments: evidence.map(e => ({
        provider: e.provider,
        reason: e.summary,
        impact: e.score_impact,
        severity: e.score_impact <= -25 ? "critical" : 
                  e.score_impact <= -10 ? "major" : 
                  e.score_impact < 0 ? "minor" : "info",
      })),
      finalScore: score,
      badge,
    };
    
    const { data: scanResult, error: scanError } = await supabase
      .from("scan_results")
      .insert({
        device_id: deviceId,
        url,
        final_url: linkIntel.payload.finalUrl,
        domain,
        platform,
        badge,
        score,
        summary,
        score_breakdown: scoreBreakdown,
        scan_version: "2.0",
      })
      .select()
      .single();
    
    if (scanError) {
      console.error("[content-scan] DB insert error:", scanError);
      throw scanError;
    }
    
    const evidenceRows = evidence.map(e => ({
      scan_id: scanResult.id,
      provider: e.provider,
      provider_label: e.provider_label,
      status: e.status,
      summary: e.summary,
      weight: e.weight,
      score_impact: e.score_impact,
      payload: e.payload,
    }));
    
    const { error: evidenceError } = await supabase
      .from("scan_evidence")
      .insert(evidenceRows);
    
    if (evidenceError) {
      console.error("[content-scan] Evidence insert error:", evidenceError);
    }
    
    const response = {
      scan_id: scanResult.id,
      badge,
      score,
      summary,
      evidence: evidence.map(e => ({
        provider: e.provider,
        status: e.status,
        summary: e.summary,
        weight: e.weight,
        payload: e.payload,
      })),
      score_breakdown: scoreBreakdown,
    };
    
    console.log("[content-scan] Scan complete:", response.scan_id, badge, score);
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[content-scan] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
