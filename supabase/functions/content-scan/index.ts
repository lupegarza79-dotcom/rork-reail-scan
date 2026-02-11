// @ts-nocheck
// Supabase Edge Function: content-scan
// POST /content-scan - Full scan with caching, threat intel, pattern match, reputation
// GET  /content-scan?health - Health check
// Returns: { scan_id, badge, score, summary, evidence[], score_breakdown }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ENDPOINT = "content-scan";
const CONTENT_SCAN_RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW_MINUTES = 60;

type BadgeType = "VERIFIED" | "UNVERIFIED" | "HIGH_RISK";
type EvidenceStatus = "pass" | "warn" | "fail" | "unknown";
type EvidenceProvider =
  | "link_intel"
  | "domain_intel"
  | "pattern_match"
  | "ssl_intel"
  | "google_safe_browsing"
  | "virustotal"
  | "reputation_reports";

const SCAM_KEYWORDS = [
  "urgent", "verify", "suspended", "investment", "crypto", "giveaway",
  "act now", "limited time", "click here", "confirm your", "update your",
  "account locked", "security alert", "unusual activity", "verify identity",
  "wire transfer", "bitcoin", "ethereum", "nft", "airdrop", "free money",
  "congratulations", "you won", "claim your", "prize", "lottery",
  "inheritance", "beneficiary", "nigerian prince", "bank transfer",
  "password expired", "login attempt", "suspicious login",
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
  "rebrand.ly", "bl.ink", "tiny.cc", "shorturl.at", "rb.gy",
];

const SUSPICIOUS_TLDS = [
  "xyz", "top", "work", "click", "link", "surf", "gdn", "date",
  "download", "stream", "racing", "win", "bid", "loan", "trade",
  "party", "science", "cricket", "faith", "review", "accountant",
  "tk", "ml", "ga", "cf", "gq", "pw", "cc", "buzz", "casa",
];

const LOOKALIKE_BRANDS: Record<string, string[]> = {
  google: ["g00gle", "googie", "gooogle", "googl3", "go0gle"],
  facebook: ["faceb00k", "facebok", "facbook", "faceboook"],
  amazon: ["amaz0n", "arnazon", "amazom", "amazonn"],
  apple: ["app1e", "appie", "applle"],
  paypal: ["paypa1", "paypai", "paypaI", "pаypal"],
  microsoft: ["micr0soft", "mircosoft", "microsofl"],
  instagram: ["1nstagram", "instagran", "lnstagram"],
  netflix: ["netfIix", "netfl1x", "neflix"],
  bank: ["banc", "bonk", "baank"],
};

const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";
function log(...args: unknown[]) {
  if (VERBOSE) console.log("[content-scan][verbose]", ...args);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}

async function logTelemetry(supabase: any, payload: Record<string, unknown> | Record<string, unknown>[]) {
  try {
    const records = Array.isArray(payload) ? payload : [payload];
    if (records.length === 0) return;
    await supabase.from("scan_telemetry_events").insert(records);
  } catch (error) {
    console.log("[Telemetry] Failed to write:", error);
  }
}

async function checkRateLimit(
  supabase: any,
  endpoint: string,
  deviceId: string,
  ip: string,
  limit: number,
  windowMinutes: number,
): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  windowSeconds: number;
}> {
  const now = new Date();
  const windowSeconds = windowMinutes * 60;
  const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
  const { data, error } = await supabase
    .from("rate_limits")
    .select("key, count, window_end, blocked_until")
    .eq("endpoint", endpoint)
    .eq("device_id", deviceId)
    .eq("ip", ip)
    .order("window_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log("[RateLimit] Lookup error:", error);
    return { allowed: true, retryAfterSeconds: 0, remaining: limit, limit, windowSeconds };
  }

  if (data?.blocked_until && new Date(data.blocked_until) > now) {
    const retryAfterSeconds = Math.ceil((new Date(data.blocked_until).getTime() - now.getTime()) / 1000);
    return { allowed: false, retryAfterSeconds, remaining: 0, limit, windowSeconds };
  }

  if (data && new Date(data.window_end) > now) {
    if (data.count >= limit) {
      await supabase
        .from("rate_limits")
        .update({ blocked_until: data.window_end, updated_at: now.toISOString() })
        .eq("key", data.key);
      const retryAfterSeconds = Math.ceil((new Date(data.window_end).getTime() - now.getTime()) / 1000);
      return { allowed: false, retryAfterSeconds, remaining: 0, limit, windowSeconds };
    }

    await supabase
      .from("rate_limits")
      .update({ count: data.count + 1, updated_at: now.toISOString(), limit })
      .eq("key", data.key);
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, limit - (data.count + 1)), limit, windowSeconds };
  }

  const key = `${endpoint}:${deviceId}:${ip}:${now.toISOString()}`;
  await supabase.from("rate_limits").upsert({
    key,
    endpoint,
    device_id: deviceId,
    ip,
    count: 1,
    limit,
    window_start: now.toISOString(),
    window_end: windowEnd.toISOString(),
    updated_at: now.toISOString(),
  });
  return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, limit - 1), limit, windowSeconds };
}

async function runProvider(
  providerName: EvidenceProvider,
  fn: () => Promise<EvidenceItem>,
  telemetry: Record<string, unknown>[],
  deviceId: string,
  ip: string,
): Promise<EvidenceItem> {
  const start = Date.now();
  try {
    const result = await fn();
    telemetry.push({
      endpoint: ENDPOINT,
      event_type: "provider",
      provider: providerName,
      latency_ms: Date.now() - start,
      status: "ok",
      success: true,
      device_id: deviceId,
      ip,
    });
    return result;
  } catch (error) {
    telemetry.push({
      endpoint: ENDPOINT,
      event_type: "provider",
      provider: providerName,
      latency_ms: Date.now() - start,
      status: "error",
      success: false,
      error_code: (error as any)?.code ?? "PROVIDER_ERROR",
      device_id: deviceId,
      ip,
    });
    throw error;
  }
}

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
    if (variants.some((v) => baseDomain.includes(v))) {
      return { isLookalike: true, lookalikeTo: brand };
    }
    if (baseDomain.includes(brand) && baseDomain !== brand) {
      const suffixes = ["-login", "-secure", "-verify", "-account", "-support"];
      if (suffixes.some((s) => baseDomain.includes(s))) {
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
    "tracking", "promo", "discount", "deal",
  ];
  try {
    const parsed = new URL(url);
    const params: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (trackingPrefixes.some((p) => key.toLowerCase().startsWith(p))) {
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
  if (SHORTLINK_DOMAINS.some((d) => initialDomain.includes(d))) shortlinkExpanded = true;

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
      if (prevDomain !== nextDomain && SHORTLINK_DOMAINS.some((d) => nextDomain.includes(d))) {
        hasDoubleHop = true;
      }
      currentUrl = nextUrl;
    } catch {
      break;
    }
  }
  return { finalUrl: currentUrl, chain, hasDoubleHop, shortlinkExpanded };
}

// --------------- PROVIDERS ---------------

async function analyzeLinkIntel(url: string): Promise<EvidenceItem> {
  console.log("[LinkIntel] Analyzing:", url);
  const { finalUrl, chain, hasDoubleHop, shortlinkExpanded } = await followRedirects(url);
  const trackingParams = extractTrackingParams(finalUrl);
  const suspiciousRedirect =
    hasDoubleHop ||
    chain.length > 5 ||
    (shortlinkExpanded &&
      chain.some((u) => {
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

  return { provider: "link_intel", provider_label: "Link Intel", status, summary, weight: 25, score_impact: scoreImpact, payload };
}

async function analyzeSsl(url: string): Promise<SslAnalysis | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return { hasSSL: false, certAgeDays: null, certExpiresInDays: null, isSelfSigned: false, issuer: null, subjectMismatch: false, validFrom: null, validTo: null };
    }
    const resp = await fetch(`https://api.ssllabs.com/api/v3/analyze?host=${parsed.hostname}&fromCache=on&maxAge=24`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      return await analyzeSslFallback(parsed.hostname);
    }
    const data = await resp.json();
    const endpoint = data?.endpoints?.[0];
    const cert = endpoint?.details?.cert;
    if (!cert) return await analyzeSslFallback(parsed.hostname);

    const validFrom = cert.notBefore ? new Date(cert.notBefore).toISOString() : null;
    const validTo = cert.notAfter ? new Date(cert.notAfter).toISOString() : null;
    const certAgeDays = validFrom ? Math.floor((Date.now() - new Date(validFrom).getTime()) / 86400000) : null;
    const certExpiresInDays = validTo ? Math.floor((new Date(validTo).getTime() - Date.now()) / 86400000) : null;
    const issuer = cert.issuerSubject || null;
    const isSelfSigned = issuer ? issuer.toLowerCase().includes(parsed.hostname.toLowerCase()) || cert.sigAlg?.includes("self") : false;
    const subjectMismatch = cert.commonNames
      ? !cert.commonNames.some((cn: string) => cn === parsed.hostname || cn.endsWith(`.${parsed.hostname}`) || (cn.startsWith("*.") && parsed.hostname.endsWith(cn.slice(1))))
      : false;

    return { hasSSL: true, certAgeDays, certExpiresInDays, isSelfSigned, issuer, subjectMismatch, validFrom, validTo };
  } catch (e) {
    console.log("[SSL] Analysis failed:", e);
    return null;
  }
}

async function analyzeSslFallback(hostname: string): Promise<SslAnalysis> {
  try {
    const resp = await fetch(`https://${hostname}`, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return { hasSSL: resp.ok || resp.status < 500, certAgeDays: null, certExpiresInDays: null, isSelfSigned: false, issuer: null, subjectMismatch: false, validFrom: null, validTo: null };
  } catch {
    return { hasSSL: false, certAgeDays: null, certExpiresInDays: null, isSelfSigned: false, issuer: null, subjectMismatch: false, validFrom: null, validTo: null };
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
    fetch(`https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${Deno.env.get("WHOIS_API_KEY")}&domainName=${domain}&outputFormat=JSON`, { signal: AbortSignal.timeout(5000) }),
    fetch(`https://dns.google/resolve?name=${domain}&type=MX`, { signal: AbortSignal.timeout(3000) }),
    analyzeSsl(url),
  ]);

  if (whoisResult.status === "fulfilled" && whoisResult.value.ok) {
    try {
      const whoisData = await whoisResult.value.json();
      const record = whoisData?.WhoisRecord;
      if (record?.createdDate) {
        createdDate = record.createdDate;
        domainAgeDays = Math.floor((Date.now() - new Date(record.createdDate).getTime()) / 86400000);
      }
      if (record?.expiresDate) expiresDate = record.expiresDate;
      if (record?.registrarName) registrar = record.registrarName;
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

  if (sslResult.status === "fulfilled") ssl = sslResult.value;

  const payload: DomainIntelPayload = {
    domain, domainAgeDays, registrar, createdDate, expiresDate,
    isPunycode: isPunycodeResult, isLookalike: lookalike.isLookalike,
    lookalikeTo: lookalike.lookalikeTo, suspiciousTld, tld,
    hasMxRecords, asnRisk, hostingProvider, ssl,
  };

  let status: EvidenceStatus = "pass";
  let summary = "Domain passed verification";
  let scoreImpact = 5;

  if (isPunycodeResult || lookalike.isLookalike) {
    status = "fail";
    summary = lookalike.isLookalike ? `Lookalike domain detected (similar to ${lookalike.lookalikeTo})` : "Punycode domain detected - possible spoofing";
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
      if (status === "pass") { status = "warn"; summary = "No SSL certificate"; }
      scoreImpact -= 10;
    } else if (ssl.isSelfSigned) {
      if (status === "pass") { status = "warn"; summary = "Self-signed SSL certificate"; }
      scoreImpact -= 15;
    } else if (ssl.subjectMismatch) {
      if (status === "pass") { status = "fail"; summary = "SSL certificate domain mismatch"; }
      scoreImpact -= 20;
    } else if (ssl.certAgeDays !== null && ssl.certAgeDays < 7) {
      if (status === "pass") { status = "warn"; summary = `SSL certificate only ${ssl.certAgeDays} days old`; }
      scoreImpact -= 5;
    } else if (ssl.certExpiresInDays !== null && ssl.certExpiresInDays < 7) {
      if (status === "pass") { status = "warn"; summary = "SSL certificate expiring soon"; }
      scoreImpact -= 5;
    }
  }

  return { provider: "domain_intel", provider_label: "Domain Intel", status, summary, weight: 30, score_impact: scoreImpact, payload };
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
        const dayAge = (now - new Date(r.created_at).getTime()) / 86400000;
        if (dayAge < 7) reportWeight += r.report_type === "scam" || r.report_type === "phishing" ? 3 : 1;
        else if (dayAge < 30) reportWeight += r.report_type === "scam" || r.report_type === "phishing" ? 2 : 0.5;
        else reportWeight += 0.25;
      }
    }
  } catch (e) {
    console.log("[PatternMatch] Report lookup failed:", e);
  }

  const payload: PatternMatchPayload = { matchedKeywords, keywordCount: matchedKeywords.length, knownScamMatch, knownScamReason, patternMatches, reportCount, reportWeight };

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

  return { provider: "pattern_match", provider_label: "Pattern Match", status, summary, weight: 20, score_impact: scoreImpact, payload };
}

// --------------- EXTERNAL THREAT INTEL ---------------

async function analyzeGoogleSafeBrowsing(url: string): Promise<EvidenceItem> {
  const apiKey = Deno.env.get("GOOGLE_SAFE_BROWSING_API_KEY");
  if (!apiKey) {
    console.log("[GoogleSafeBrowsing] API key not set, returning unknown");
    return {
      provider: "google_safe_browsing", provider_label: "Google Safe Browsing",
      status: "unknown", summary: "Google Safe Browsing not configured", weight: 0, score_impact: 0,
      payload: { configured: false },
    };
  }

  try {
    console.log("[GoogleSafeBrowsing] Checking:", url);
    const resp = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "reail-scanner", clientVersion: "2.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      console.log("[GoogleSafeBrowsing] API error:", resp.status);
      return {
        provider: "google_safe_browsing", provider_label: "Google Safe Browsing",
        status: "unknown", summary: "Google Safe Browsing API error", weight: 0, score_impact: 0,
        payload: { configured: true, apiError: resp.status },
      };
    }

    const data = await resp.json();
    const matches = data.matches || [];

    if (matches.length > 0) {
      const threats = matches.map((m: any) => m.threatType);
      return {
        provider: "google_safe_browsing", provider_label: "Google Safe Browsing",
        status: "fail", summary: `Flagged by Google: ${threats.join(", ")}`, weight: 15, score_impact: -30,
        payload: { configured: true, threats, matchCount: matches.length },
      };
    }

    return {
      provider: "google_safe_browsing", provider_label: "Google Safe Browsing",
      status: "pass", summary: "Not flagged by Google Safe Browsing", weight: 15, score_impact: 5,
      payload: { configured: true, threats: [], matchCount: 0 },
    };
  } catch (e) {
    console.log("[GoogleSafeBrowsing] Error:", e);
    return {
      provider: "google_safe_browsing", provider_label: "Google Safe Browsing",
      status: "unknown", summary: "Google Safe Browsing check failed", weight: 0, score_impact: 0,
      payload: { configured: true, error: String(e) },
    };
  }
}

async function analyzeVirusTotal(url: string): Promise<EvidenceItem> {
  const apiKey = Deno.env.get("VIRUSTOTAL_API_KEY");
  if (!apiKey) {
    console.log("[VirusTotal] API key not set, returning unknown");
    return {
      provider: "virustotal", provider_label: "VirusTotal",
      status: "unknown", summary: "VirusTotal not configured", weight: 0, score_impact: 0,
      payload: { configured: false },
    };
  }

  try {
    console.log("[VirusTotal] Checking:", url);
    const urlId = btoa(url).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    const resp = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { "x-apikey": apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (resp.status === 404) {
      const submitResp = await fetch("https://www.virustotal.com/api/v3/urls", {
        method: "POST",
        headers: { "x-apikey": apiKey, "Content-Type": "application/x-www-form-urlencoded" },
        body: `url=${encodeURIComponent(url)}`,
        signal: AbortSignal.timeout(8000),
      });
      if (!submitResp.ok) {
        return {
          provider: "virustotal", provider_label: "VirusTotal",
          status: "unknown", summary: "URL submitted to VirusTotal (pending)", weight: 0, score_impact: 0,
          payload: { configured: true, pending: true },
        };
      }
      return {
        provider: "virustotal", provider_label: "VirusTotal",
        status: "unknown", summary: "URL submitted to VirusTotal for first scan", weight: 0, score_impact: 0,
        payload: { configured: true, pending: true },
      };
    }

    if (!resp.ok) {
      return {
        provider: "virustotal", provider_label: "VirusTotal",
        status: "unknown", summary: "VirusTotal API error", weight: 0, score_impact: 0,
        payload: { configured: true, apiError: resp.status },
      };
    }

    const data = await resp.json();
    const stats = data?.data?.attributes?.last_analysis_stats || {};
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const total = (stats.harmless || 0) + (stats.undetected || 0) + malicious + suspicious;
    const flagged = malicious + suspicious;

    if (flagged >= 5) {
      return {
        provider: "virustotal", provider_label: "VirusTotal",
        status: "fail", summary: `Flagged by ${flagged}/${total} engines on VirusTotal`, weight: 15, score_impact: -25,
        payload: { configured: true, stats, flagged, total },
      };
    } else if (flagged >= 2) {
      return {
        provider: "virustotal", provider_label: "VirusTotal",
        status: "warn", summary: `${flagged}/${total} engines flagged on VirusTotal`, weight: 15, score_impact: -10,
        payload: { configured: true, stats, flagged, total },
      };
    }

    return {
      provider: "virustotal", provider_label: "VirusTotal",
      status: "pass", summary: `Clean on VirusTotal (${total} engines)`, weight: 15, score_impact: 5,
      payload: { configured: true, stats, flagged: 0, total },
    };
  } catch (e) {
    console.log("[VirusTotal] Error:", e);
    return {
      provider: "virustotal", provider_label: "VirusTotal",
      status: "unknown", summary: "VirusTotal check failed", weight: 0, score_impact: 0,
      payload: { configured: true, error: String(e) },
    };
  }
}

// --------------- REPUTATION FROM REPORTS ---------------

async function analyzeReputationFromReports(url: string, supabaseUrl: string, serviceKey: string): Promise<EvidenceItem> {
  const domain = extractDomain(url);
  console.log("[ReputationReports] Checking:", domain);

  try {
    const sb = createClient(supabaseUrl, serviceKey);
    const { data: agg } = await sb
      .from("report_aggregates")
      .select("*")
      .or(`url.eq.${url},domain.eq.${domain}`)
      .limit(10);

    let totalReports = 0;
    let scamCount = 0;
    let phishingCount = 0;
    let safeCount = 0;
    let recentReports = 0;

    if (agg && agg.length > 0) {
      for (const row of agg) {
        totalReports += row.total_reports || 0;
        scamCount += row.scam_count || 0;
        phishingCount += row.phishing_count || 0;
        safeCount += row.safe_count || 0;
        recentReports += row.recent_reports || 0;
      }
    }

    const payload = { domain, totalReports, scamCount, phishingCount, safeCount, recentReports };

    if (totalReports === 0) {
      return {
        provider: "reputation_reports", provider_label: "Community Reports",
        status: "pass", summary: "No community reports for this URL", weight: 10, score_impact: 0,
        payload,
      };
    }

    const dangerCount = scamCount + phishingCount;
    const dangerRatio = dangerCount / totalReports;

    if (dangerRatio >= 0.7 && totalReports >= 3) {
      return {
        provider: "reputation_reports", provider_label: "Community Reports",
        status: "fail", summary: `${dangerCount}/${totalReports} reports flag this as dangerous`, weight: 10, score_impact: -20,
        payload,
      };
    } else if (dangerRatio >= 0.4 || recentReports >= 3) {
      return {
        provider: "reputation_reports", provider_label: "Community Reports",
        status: "warn", summary: `${totalReports} community reports (${dangerCount} negative)`, weight: 10, score_impact: -10,
        payload,
      };
    } else if (safeCount > dangerCount) {
      return {
        provider: "reputation_reports", provider_label: "Community Reports",
        status: "pass", summary: `Community rates this URL as mostly safe (${safeCount} safe vs ${dangerCount} flagged)`, weight: 10, score_impact: 3,
        payload,
      };
    }

    return {
      provider: "reputation_reports", provider_label: "Community Reports",
      status: "warn", summary: `${totalReports} community reports filed`, weight: 10, score_impact: -5,
      payload,
    };
  } catch (e) {
    console.log("[ReputationReports] Error:", e);
    return {
      provider: "reputation_reports", provider_label: "Community Reports",
      status: "unknown", summary: "Could not retrieve community reports", weight: 0, score_impact: 0,
      payload: { error: String(e) },
    };
  }
}

// --------------- CACHING ---------------

async function getCachedScan(supabase: any, cacheKey: string): Promise<any | null> {
  try {
    const { data } = await supabase
      .from("scan_cache")
      .select("value, expires_at")
      .eq("key", cacheKey)
      .single();
    if (data && new Date(data.expires_at) > new Date()) {
      console.log("[Cache] HIT for:", cacheKey);
      return data.value;
    }
    if (data) {
      console.log("[Cache] EXPIRED for:", cacheKey);
      await supabase.from("scan_cache").delete().eq("key", cacheKey);
    }
    return null;
  } catch {
    return null;
  }
}

async function setCachedScan(supabase: any, cacheKey: string, value: any, ttlHours: number): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlHours * 3600000).toISOString();
    await supabase.from("scan_cache").upsert({
      key: cacheKey,
      value,
      expires_at: expiresAt,
    });
    console.log("[Cache] SET for:", cacheKey, "TTL:", ttlHours, "hours");
  } catch (e) {
    console.log("[Cache] SET failed:", e);
  }
}

// --------------- SCORING ---------------

function calculateScore(evidence: EvidenceItem[]): { score: number; badge: BadgeType } {
  const BASE_SCORE = 70;
  const totalImpact = evidence.filter((e) => e.status !== "unknown").reduce((sum, e) => sum + e.score_impact, 0);
  const rawScore = BASE_SCORE + totalImpact;
  const score = Math.max(0, Math.min(100, rawScore));
  const hasCriticalFail = evidence.some((e) => e.status === "fail" && e.score_impact <= -25);

  let badge: BadgeType;
  if (hasCriticalFail || score < 50) badge = "HIGH_RISK";
  else if (score >= 80 && !evidence.some((e) => e.status === "fail")) badge = "VERIFIED";
  else badge = "UNVERIFIED";

  return { score, badge };
}

function generateSummary(badge: BadgeType, evidence: EvidenceItem[], domain: string): string {
  const failedChecks = evidence.filter((e) => e.status === "fail");
  const warnChecks = evidence.filter((e) => e.status === "warn");
  if (badge === "HIGH_RISK") {
    if (failedChecks.length > 0) return `High risk detected: ${failedChecks.map((e) => e.summary).join(". ")}`;
    return `High risk indicators found for ${domain}`;
  }
  if (badge === "VERIFIED") return `${domain} passed all verification checks`;
  if (warnChecks.length > 0) return `Some concerns found: ${warnChecks.map((e) => e.summary).join(". ")}`;
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

function buildEvidenceRow(scanId: string, e: EvidenceItem) {
  return {
    scan_id: scanId,
    provider: e.provider,
    card_title: e.provider_label,
    card_status: e.status,
    card_payload: {
      summary: e.summary,
      weight: e.weight,
      score_impact: e.score_impact,
      ...e.payload,
    },
  };
}

// --------------- HANDLER ---------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("health") !== null) {
      return new Response(JSON.stringify({
        ok: true,
        endpoint: ENDPOINT,
        details: {
          secrets: {
            PROJECT_URL: !!Deno.env.get("PROJECT_URL"),
            SERVICE_ROLE_KEY: !!Deno.env.get("SERVICE_ROLE_KEY"),
            GOOGLE_SAFE_BROWSING_API_KEY: !!Deno.env.get("GOOGLE_SAFE_BROWSING_API_KEY"),
            VIRUSTOTAL_API_KEY: !!Deno.env.get("VIRUSTOTAL_API_KEY"),
            CACHE_TTL_HOURS: Deno.env.get("CACHE_TTL_HOURS") || "24",
          },
          verbose: VERBOSE,
        },
        timestamp: new Date().toISOString(),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      ok: false,
      error_code: "method_not_allowed",
      message: "Method not allowed",
      endpoint: ENDPOINT,
    }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  try {
    const deviceId = req.headers.get("x-device-id") || "anonymous";
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "URL is required",
        endpoint: ENDPOINT,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[content-scan] Starting scan for:", url, "device:", deviceId);

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const ip = getClientIp(req);

    const rateCheck = await checkRateLimit(
      supabase,
      "content-scan",
      deviceId,
      ip,
      CONTENT_SCAN_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MINUTES,
    );
    if (!rateCheck.allowed) {
      void logTelemetry(supabase, {
        endpoint: ENDPOINT,
        event_type: "scan",
        device_id: deviceId,
        ip,
        status: "rate_limited",
        latency_ms: 0,
        cache_hit: null,
      });
      return new Response(JSON.stringify({
        ok: false,
        error_code: "rate_limit_exceeded",
        message: "Rate limit exceeded",
        endpoint: ENDPOINT,
        retry_after_seconds: rateCheck.retryAfterSeconds,
        rate_limit: {
          remaining: rateCheck.remaining,
          limit: rateCheck.limit,
          window_seconds: rateCheck.windowSeconds,
        },
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfterSeconds),
        },
      });
    }

    const cacheTtl = parseInt(Deno.env.get("CACHE_TTL_HOURS") || "24", 10);
    const cacheKey = `scan:${url}`;

    const cached = await getCachedScan(supabase, cacheKey);
    if (cached) {
      const { data: scanResult } = await supabase
        .from("scan_results")
        .insert({
          device_id: deviceId, url, final_url: cached.final_url, domain: cached.domain,
          platform: cached.platform, badge: cached.badge, score: cached.score,
          summary: cached.summary, score_breakdown: cached.score_breakdown, scan_version: "2.0",
        })
        .select().single();

      if (scanResult) {
        const rows = (cached.evidence || []).map((e: any) => buildEvidenceRow(scanResult.id, e));
        await supabase.from("scan_evidence").insert(rows);
        void logTelemetry(supabase, {
          endpoint: ENDPOINT,
          event_type: "scan",
          device_id: deviceId,
          ip,
          scan_id: scanResult.id,
          score: cached.score,
          badge: cached.badge,
          cache_hit: true,
          status: "ok",
          latency_ms: Date.now() - startTime,
          success: true,
        });

        return new Response(JSON.stringify({
          ok: true,
          scan_id: scanResult.id, badge: cached.badge, score: cached.score,
          summary: cached.summary, cache_hit: true,
          rate_limit: {
            remaining: rateCheck.remaining,
            limit: rateCheck.limit,
            window_seconds: rateCheck.windowSeconds,
          },
          evidence: cached.evidence.map((e: any) => ({ provider: e.provider, status: e.status, summary: e.summary, weight: e.weight, payload: e.payload })),
          score_breakdown: cached.score_breakdown,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const providerTelemetry: Record<string, unknown>[] = [];

    const [
      linkIntel,
      domainIntel,
      patternMatch,
      googleSB,
      virusTotal,
      reputation,
    ] = await Promise.all([
      runProvider(
        "link_intel",
        () => analyzeLinkIntel(url),
        providerTelemetry,
        deviceId,
        ip,
      ),
      runProvider(
        "domain_intel",
        () => analyzeDomainIntel(url),
        providerTelemetry,
        deviceId,
        ip,
      ),
      runProvider(
        "pattern_match",
        () => analyzePatternMatch(url, supabaseUrl, supabaseServiceKey),
        providerTelemetry,
        deviceId,
        ip,
      ),
      runProvider(
        "google_safe_browsing",
        () => analyzeGoogleSafeBrowsing(url),
        providerTelemetry,
        deviceId,
        ip,
      ),
      runProvider(
        "virustotal",
        () => analyzeVirusTotal(url),
        providerTelemetry,
        deviceId,
        ip,
      ),
      runProvider(
        "reputation_reports",
        () => analyzeReputationFromReports(url, supabaseUrl, supabaseServiceKey),
        providerTelemetry,
        deviceId,
        ip,
      ),
    ]);

    const evidence: EvidenceItem[] = [linkIntel, domainIntel, patternMatch, googleSB, virusTotal, reputation];
    const { score, badge } = calculateScore(evidence);
    const domain = extractDomain((linkIntel.payload as any).finalUrl || url);
    const summary = generateSummary(badge, evidence, domain);
    const platform = detectPlatform(url);

    const scoreBreakdown = {
      baseScore: 70,
      adjustments: evidence.map((e) => ({
        provider: e.provider,
        reason: e.summary,
        impact: e.score_impact,
        severity: e.score_impact <= -25 ? "critical" : e.score_impact <= -10 ? "major" : e.score_impact < 0 ? "minor" : "info",
      })),
      finalScore: score,
      badge,
    };

    const { data: scanResult, error: scanError } = await supabase
      .from("scan_results")
      .insert({
        device_id: deviceId, url, final_url: (linkIntel.payload as any).finalUrl,
        domain, platform, badge, score, summary, score_breakdown: scoreBreakdown, scan_version: "2.0",
      })
      .select().single();

    if (scanError) {
      console.error("[content-scan] DB insert error:", scanError);
      throw scanError;
    }

    void logTelemetry(supabase, [
      {
        endpoint: ENDPOINT,
        event_type: "scan",
        device_id: deviceId,
        ip,
        scan_id: scanResult.id,
        score,
        badge,
        cache_hit: false,
        status: "ok",
        latency_ms: Date.now() - startTime,
        success: true,
      },
      ...providerTelemetry,
    ]);

    const evidenceRows = evidence.map((e) => buildEvidenceRow(scanResult.id, e));
    const { error: evidenceError } = await supabase.from("scan_evidence").insert(evidenceRows);
    if (evidenceError) console.error("[content-scan] Evidence insert error:", evidenceError);

    await setCachedScan(supabase, cacheKey, {
      badge, score, summary, domain, platform,
      final_url: (linkIntel.payload as any).finalUrl,
      evidence, score_breakdown: scoreBreakdown,
    }, cacheTtl);

    const response = {
      ok: true,
      scan_id: scanResult.id, badge, score, summary, cache_hit: false,
      rate_limit: {
        remaining: rateCheck.remaining,
        limit: rateCheck.limit,
        window_seconds: rateCheck.windowSeconds,
      },
      evidence: evidence.map((e) => ({ provider: e.provider, status: e.status, summary: e.summary, weight: e.weight, payload: e.payload })),
      score_breakdown: scoreBreakdown,
    };

    console.log("[content-scan] Scan complete:", response.scan_id, badge, score);
    return new Response(JSON.stringify(response), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[content-scan] Error:", error);
    try {
      const supabaseUrl = Deno.env.get("PROJECT_URL");
      const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const deviceId = req.headers.get("x-device-id") || "anonymous";
        const ip = getClientIp(req);
        await logTelemetry(supabase, {
          endpoint: ENDPOINT,
          event_type: "scan",
          device_id: deviceId,
          ip,
          status: "error",
          latency_ms: Date.now() - startTime,
          cache_hit: null,
          error_code: (error as any)?.code ?? "internal_error",
        });
      }
    } catch (telemetryError) {
      console.log("[Telemetry] Failed to write error event:", telemetryError);
    }
    const errObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      ok: false,
      error_code: (error as any)?.code ?? "internal_error",
      message: errObj.message,
      endpoint: ENDPOINT,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
