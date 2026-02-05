// @ts-nocheck
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
type EvidenceProvider = "link_intel" | "domain_intel" | "social_context" | "pattern_match" | "ssl_intel";

const SCAM_KEYWORDS = [
  "urgent", "verify", "suspended", "investment", "crypto", "giveaway",
  "act now", "limited time", "click here", "confirm your", "update your",
  "account locked", "security alert", "unusual activity", "verify identity",
  "wire transfer", "bitcoin", "ethereum", "nft", "airdrop", "free money",
  "congratulations", "you won", "claim your", "prize", "lottery",
  "inheritance", "beneficiary", "nigerian prince", "bank transfer",
  "password expired", "login attempt", "suspicious login"
];

const KNOWN_SCAM_URLS: Record<string, { reason: string; severity: "high" | "medium" }> = {
  "secure-login-verify.com": { reason: "Known phishing domain", severity: "high" },
  "account-verify-now.com": { reason: "Known phishing domain", severity: "high" },
  "free-crypto-giveaway.xyz": { reason: "Crypto scam domain", severity: "high" },
  "investment-returns-guaranteed.com": { reason: "Investment scam", severity: "high" },
  "urgent-bank-verify.net": { reason: "Banking phishing", severity: "high" },
  "apple-id-locked.com": { reason: "Apple phishing", severity: "high" },
  "netflix-payment-update.com": { reason: "Netflix phishing", severity: "high" },
  "amazon-order-problem.com": { reason: "Amazon phishing", severity: "high" },
  "paypal-limited-account.com": { reason: "PayPal phishing", severity: "high" },
  "microsoft-security-alert.com": { reason: "Microsoft phishing", severity: "high" },
  "coinbase-verify-account.com": { reason: "Crypto exchange phishing", severity: "high" },
  "binance-airdrop.xyz": { reason: "Crypto scam", severity: "high" },
  "telegram-verify.com": { reason: "Telegram phishing", severity: "medium" },
  "whatsapp-update-required.com": { reason: "WhatsApp phishing", severity: "medium" },
};

const SCAM_URL_PATTERNS = [
  /secure.*login.*verify/i,
  /account.*verify.*now/i,
  /free.*crypto/i,
  /investment.*guarantee/i,
  /urgent.*bank/i,
  /\w+-id-locked/i,
  /\w+-payment-update/i,
  /\w+-order-problem/i,
  /\w+-limited-account/i,
  /\w+-security-alert/i,
  /verify-.*-account/i,
  /.*-airdrop\./i,
];

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
  ssl: SslAnalysis | null;
}

interface SslAnalysis {
  hasSSL: boolean;
  certAgeDays: number | null;
  certExpiresInDays: number | null;
  isSelfSigned: boolean;
  issuer: string | null;
  subjectMismatch: boolean;
  validFrom: string | null;
  validTo: string | null;
}

interface PatternMatchPayload {
  matchedKeywords: string[];
  keywordCount: number;
  knownScamMatch: boolean;
  knownScamReason: string | null;
  patternMatches: string[];
  reportCount: number;
  reportWeight: number;
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

async function analyzeSsl(url: string): Promise<SslAnalysis | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return { hasSSL: false, certAgeDays: null, certExpiresInDays: null, isSelfSigned: false, issuer: null, subjectMismatch: false, validFrom: null, validTo: null };
    }
    
    const resp = await fetch(`https://api.ssllabs.com/api/v3/analyze?host=${parsed.hostname}&fromCache=on&maxAge=24`, {
      signal: AbortSignal.timeout(5000),
    });
    
    if (!resp.ok) {
      console.log("[SSL] SSLLabs API failed, using fallback");
      return await analyzeSslFallback(parsed.hostname);
    }
    
    const data = await resp.json();
    const endpoint = data?.endpoints?.[0];
    const cert = endpoint?.details?.cert;
    
    if (!cert) {
      return await analyzeSslFallback(parsed.hostname);
    }
    
    const validFrom = cert.notBefore ? new Date(cert.notBefore).toISOString() : null;
    const validTo = cert.notAfter ? new Date(cert.notAfter).toISOString() : null;
    const certAgeDays = validFrom ? Math.floor((Date.now() - new Date(validFrom).getTime()) / (1000 * 60 * 60 * 24)) : null;
    const certExpiresInDays = validTo ? Math.floor((new Date(validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    
    const issuer = cert.issuerSubject || null;
    const isSelfSigned = issuer ? issuer.toLowerCase().includes(parsed.hostname.toLowerCase()) || cert.sigAlg?.includes("self") : false;
    const subjectMismatch = cert.commonNames ? !cert.commonNames.some((cn: string) => cn === parsed.hostname || cn.endsWith(`.${parsed.hostname}`) || (cn.startsWith("*.") && parsed.hostname.endsWith(cn.slice(1)))) : false;
    
    return {
      hasSSL: true,
      certAgeDays,
      certExpiresInDays,
      isSelfSigned,
      issuer,
      subjectMismatch,
      validFrom,
      validTo,
    };
  } catch (e) {
    console.log("[SSL] Analysis failed:", e);
    return null;
  }
}

async function analyzeSslFallback(hostname: string): Promise<SslAnalysis> {
  try {
    const resp = await fetch(`https://${hostname}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    return {
      hasSSL: resp.ok || resp.status < 500,
      certAgeDays: null,
      certExpiresInDays: null,
      isSelfSigned: false,
      issuer: null,
      subjectMismatch: false,
      validFrom: null,
      validTo: null,
    };
  } catch {
    return {
      hasSSL: false,
      certAgeDays: null,
      certExpiresInDays: null,
      isSelfSigned: false,
      issuer: null,
      subjectMismatch: false,
      validFrom: null,
      validTo: null,
    };
  }
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
  let ssl: SslAnalysis | null = null;
  
  const [whoisResult, dnsResult, sslResult] = await Promise.allSettled([
    fetch(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${Deno.env.get("WHOIS_API_KEY")}&domainName=${domain}&outputFormat=JSON`,
      { signal: AbortSignal.timeout(5000) }
    ),
    fetch(
      `https://dns.google/resolve?name=${domain}&type=MX`,
      { signal: AbortSignal.timeout(3000) }
    ),
    analyzeSsl(url),
  ]);
  
  if (whoisResult.status === "fulfilled" && whoisResult.value.ok) {
    try {
      const whoisData = await whoisResult.value.json();
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
    } catch (e) {
      console.log("[DomainIntel] WHOIS parse failed:", e);
    }
  }
  
  if (dnsResult.status === "fulfilled" && dnsResult.value.ok) {
    try {
      const dnsData = await dnsResult.value.json();
      hasMxRecords = (dnsData?.Answer?.length ?? 0) > 0;
    } catch {
      console.log("[DomainIntel] DNS parse failed");
    }
  }
  
  if (sslResult.status === "fulfilled") {
    ssl = sslResult.value;
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
    ssl,
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
  
  if (ssl) {
    if (!ssl.hasSSL) {
      if (status === "pass") {
        status = "warn";
        summary = "No SSL certificate";
      }
      scoreImpact -= 10;
    } else if (ssl.isSelfSigned) {
      if (status === "pass") {
        status = "warn";
        summary = "Self-signed SSL certificate";
      }
      scoreImpact -= 15;
    } else if (ssl.subjectMismatch) {
      if (status === "pass") {
        status = "fail";
        summary = "SSL certificate domain mismatch";
      }
      scoreImpact -= 20;
    } else if (ssl.certAgeDays !== null && ssl.certAgeDays < 7) {
      if (status === "pass") {
        status = "warn";
        summary = `SSL certificate only ${ssl.certAgeDays} days old`;
      }
      scoreImpact -= 5;
    } else if (ssl.certExpiresInDays !== null && ssl.certExpiresInDays < 7) {
      if (status === "pass") {
        status = "warn";
        summary = "SSL certificate expiring soon";
      }
      scoreImpact -= 5;
    }
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

async function analyzePatternMatch(url: string, supabaseUrl: string, serviceKey: string): Promise<EvidenceItem> {
  const domain = extractDomain(url);
  const urlLower = url.toLowerCase();
  console.log("[PatternMatch] Analyzing:", url);
  
  const matchedKeywords: string[] = [];
  for (const keyword of SCAM_KEYWORDS) {
    if (urlLower.includes(keyword.toLowerCase().replace(/ /g, ""))) {
      matchedKeywords.push(keyword);
    }
  }
  
  const knownScam = KNOWN_SCAM_URLS[domain];
  const knownScamMatch = !!knownScam;
  const knownScamReason = knownScam?.reason || null;
  
  const patternMatches: string[] = [];
  for (const pattern of SCAM_URL_PATTERNS) {
    if (pattern.test(domain) || pattern.test(url)) {
      patternMatches.push(pattern.source);
    }
  }
  
  let reportCount = 0;
  let reportWeight = 0;
  try {
    const sb = createClient(supabaseUrl, serviceKey);
    const { data: reports } = await sb
      .from("scan_reports")
      .select("report_type, created_at")
      .or(`url.eq.${url},domain.eq.${domain}`)
      .limit(100);
    
    if (reports && reports.length > 0) {
      reportCount = reports.length;
      const now = Date.now();
      for (const r of reports) {
        const age = now - new Date(r.created_at).getTime();
        const dayAge = age / (1000 * 60 * 60 * 24);
        if (dayAge < 7) {
          reportWeight += r.report_type === "scam" ? 3 : r.report_type === "phishing" ? 3 : 1;
        } else if (dayAge < 30) {
          reportWeight += r.report_type === "scam" ? 2 : r.report_type === "phishing" ? 2 : 0.5;
        } else {
          reportWeight += 0.25;
        }
      }
    }
  } catch (e) {
    console.log("[PatternMatch] Report lookup failed:", e);
  }
  
  const payload: PatternMatchPayload = {
    matchedKeywords,
    keywordCount: matchedKeywords.length,
    knownScamMatch,
    knownScamReason,
    patternMatches,
    reportCount,
    reportWeight,
  };
  
  let status: EvidenceStatus = "pass";
  let summary = "No scam patterns detected";
  let scoreImpact = 5;
  
  if (knownScamMatch) {
    status = "fail";
    summary = `Known scam: ${knownScamReason}`;
    scoreImpact = knownScam?.severity === "high" ? -40 : -25;
  } else if (reportWeight >= 10) {
    status = "fail";
    summary = `${reportCount} user reports (high confidence scam)`;
    scoreImpact = -30;
  } else if (patternMatches.length > 0) {
    status = "fail";
    summary = "URL matches known scam patterns";
    scoreImpact = -25;
  } else if (matchedKeywords.length >= 3) {
    status = "fail";
    summary = `Multiple scam keywords detected: ${matchedKeywords.slice(0, 3).join(", ")}`;
    scoreImpact = -20;
  } else if (reportWeight >= 3) {
    status = "warn";
    summary = `${reportCount} user reports flagged this URL`;
    scoreImpact = -15;
  } else if (matchedKeywords.length >= 1) {
    status = "warn";
    summary = `Scam keyword detected: ${matchedKeywords[0]}`;
    scoreImpact = -10;
  } else if (reportCount > 0) {
    status = "warn";
    summary = `${reportCount} previous user report(s)`;
    scoreImpact = -5;
  }
  
  console.log("[PatternMatch] Result:", { status, summary, scoreImpact });
  
  return {
    provider: "pattern_match",
    provider_label: "Pattern Match",
    status,
    summary,
    weight: 20,
    score_impact: scoreImpact,
    payload,
  };
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
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const [linkIntel, domainIntel, patternMatch] = await Promise.all([
      analyzeLinkIntel(url),
      analyzeDomainIntel(url),
      analyzePatternMatch(url, supabaseUrl, supabaseServiceKey),
    ]);
    
    const evidence: EvidenceItem[] = [linkIntel, domainIntel, patternMatch];
    const { score, badge } = calculateScore(evidence);
    const domain = extractDomain(linkIntel.payload.finalUrl as string || url);
    const summary = generateSummary(badge, evidence, domain);
    const platform = detectPlatform(url);
    
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
