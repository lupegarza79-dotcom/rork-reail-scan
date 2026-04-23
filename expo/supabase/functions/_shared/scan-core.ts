// @ts-nocheck
// Shared scan core — used by quick-scan (HTTP wrapper) and wallet-share (internal).
// Guarantees an evidence-backed verdict on every call: badge, score, next_action
// are never null, top_red_flags is always an array, evidence is always an array.

import { webRiskLookup } from "./webrisk.ts";

export type Badge = "VERIFIED" | "UNVERIFIED" | "HIGH_RISK";
export type EvidenceStatus = "pass" | "warn" | "fail" | "unknown";

export interface EvidenceCard {
  provider: string;
  provider_label: string;
  status: EvidenceStatus;
  summary: string;
  weight: number;
  score_impact: number;
  payload: Record<string, unknown>;
  card_title: string;
  card_status: EvidenceStatus;
  card_payload: Record<string, unknown>;
}

export interface ScanCoreResult {
  url: string;
  normalized_url: string;
  domain: string;
  badge: Badge;
  score: number;
  trust_score: number;
  verdict: "clear" | "warning" | "danger" | "unknown";
  reason_codes: string[];
  providers: Record<string, unknown>;
  evidence: EvidenceCard[];
  top_red_flags: string[];
  next_action: string;
  trace_id: string;
  ts: string;
}

const UTM_PREFIXES = ["utm_", "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "igshid"];
const TRACKING_KEYS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "igshid",
  "yclid",
  "msclkid",
  "vero_id",
  "vero_conv",
]);

const SHORTLINK_DOMAINS = new Set([
  "bit.ly", "t.co", "goo.gl", "tinyurl.com", "is.gd", "ow.ly", "buff.ly",
  "rebrand.ly", "cutt.ly", "rb.gy", "s.id", "tny.im", "shorturl.at", "tiny.cc",
  "lnkd.in", "t.ly", "shrtco.de", "bl.ink", "soo.gd", "clck.ru", "v.gd",
  "short.io", "snip.ly", "bit.do", "adf.ly", "mcaf.ee",
]);

const SUSPICIOUS_TLDS = new Set([
  "zip", "mov", "xyz", "top", "click", "link", "tk", "ml", "ga", "cf", "gq",
  "work", "loan", "win", "bid", "stream", "download", "review", "country",
  "kim", "cricket", "science", "party", "gdn", "men", "rest", "lol",
]);

const SUSPICIOUS_QUERY_KEYS = new Set([
  "token", "session", "sid", "auth", "login", "verify", "wallet", "seed",
  "otp", "code", "confirm", "account", "unlock", "reset", "secure",
]);

const BAIT_PATH_PATTERNS = [
  /login/i, /sign-?in/i, /verify/i, /secure/i, /account/i, /update/i,
  /confirm/i, /wallet/i, /seed/i, /recover/i, /unlock/i, /suspend/i,
  /restricted/i, /authenticat/i, /billing/i, /reset-?password/i,
];

const KNOWN_BRANDS = [
  "google", "apple", "microsoft", "amazon", "paypal", "facebook", "instagram",
  "whatsapp", "netflix", "coinbase", "binance", "metamask", "uniswap",
  "opensea", "discord", "twitter", "x", "linkedin", "github", "dropbox",
  "icloud", "outlook", "yahoo", "tiktok", "youtube", "revolut", "wise",
  "chase", "wellsfargo", "citibank", "hsbc", "barclays", "santander",
  "stripe", "square", "cashapp", "venmo", "zelle",
];

export function normalizeUrl(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let input = raw.trim();
  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }
  try {
    const u = new URL(input);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.hash = "";
    const keep: [string, string][] = [];
    u.searchParams.forEach((value, key) => {
      const k = key.toLowerCase();
      if (TRACKING_KEYS.has(k)) return;
      if (UTM_PREFIXES.some((p) => k.startsWith(p))) return;
      keep.push([key, value]);
    });
    keep.sort(([a], [b]) => a.localeCompare(b));
    const sp = new URLSearchParams();
    for (const [k, v] of keep) sp.append(k, v);
    u.search = sp.toString();
    let out = u.toString();
    if (out.endsWith("/") && u.pathname === "/") {
      out = out.slice(0, -1);
    } else if (u.pathname.length > 1 && out.endsWith("/") && !u.search) {
      out = out.slice(0, -1);
    }
    return out;
  } catch {
    return input.toLowerCase();
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.split("/")[0].replace(/^www\./, "");
  }
}

function getTld(domain: string): string {
  const parts = domain.split(".");
  return parts.length > 0 ? parts[parts.length - 1].toLowerCase() : "";
}

function getRegistrable(domain: string): string {
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join(".");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

function detectLookalikeBrand(domain: string): { brand: string; distance: number } | null {
  const registrable = getRegistrable(domain);
  const base = registrable.split(".")[0].toLowerCase();
  if (!base || base.length < 3) return null;
  for (const brand of KNOWN_BRANDS) {
    if (base === brand) return null;
    const d = levenshtein(base, brand);
    if (d > 0 && d <= 2 && Math.abs(base.length - brand.length) <= 2) {
      return { brand, distance: d };
    }
    if (base.includes(brand) && base !== brand && base.length <= brand.length + 10) {
      return { brand, distance: 0 };
    }
  }
  return null;
}

export function computeNextAction(badge: Badge, score: number, redFlags: string[]): string {
  if (badge === "HIGH_RISK" || score < 50) {
    return "Do NOT click this link. It shows signs of a scam or phishing attempt.";
  }
  if (badge === "UNVERIFIED" || score < 80) {
    if (redFlags.length > 0) {
      return "Proceed with caution. Verify the sender and avoid entering personal info.";
    }
    return "This link couldn't be fully verified. Double-check the source before proceeding.";
  }
  return "This link appears safe, but always verify unexpected requests for personal info.";
}

function generateTraceId(): string {
  return `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function finalize(card: Omit<EvidenceCard, "card_title" | "card_status" | "card_payload">): EvidenceCard {
  return {
    ...card,
    card_title: card.provider_label,
    card_status: card.status,
    card_payload: { summary: card.summary, ...card.payload },
  };
}

async function runWebRisk(url: string): Promise<EvidenceCard> {
  try {
    const result = await Promise.race([
      webRiskLookup(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]) as { threatTypes: string[] };

    const threats = result.threatTypes || [];
    if (threats.length === 0) {
      return finalize({
        provider: "google_webrisk",
        provider_label: "Google Web Risk",
        status: "pass",
        summary: "No known threats detected by Google Web Risk",
        weight: 40,
        score_impact: 15,
        payload: { threatTypes: [], verdict: "clear" },
      });
    }
    const isDanger = threats.includes("MALWARE") || threats.includes("SOCIAL_ENGINEERING");
    return finalize({
      provider: "google_webrisk",
      provider_label: "Google Web Risk",
      status: isDanger ? "fail" : "warn",
      summary: isDanger
        ? `Flagged by Google Web Risk: ${threats.join(", ")}`
        : `Listed by Google Web Risk: ${threats.join(", ")}`,
      weight: 40,
      score_impact: isDanger ? -70 : -25,
      payload: { threatTypes: threats, verdict: isDanger ? "danger" : "warning", critical: isDanger },
    });
  } catch (err) {
    console.error("[scan-core] WebRisk failed (fail-soft):", err);
    return finalize({
      provider: "google_webrisk",
      provider_label: "Google Web Risk",
      status: "unknown",
      summary: "Google Web Risk check unavailable",
      weight: 40,
      score_impact: 0,
      payload: { error: "unavailable", verdict: "unknown" },
    });
  }
}

async function runUrlhaus(url: string): Promise<EvidenceCard> {
  try {
    const resp = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `url=${encodeURIComponent(url)}`,
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      return finalize({
        provider: "urlhaus",
        provider_label: "URLhaus (abuse.ch)",
        status: "unknown",
        summary: "URLhaus check unavailable",
        weight: 30,
        score_impact: 0,
        payload: { error: "api_error", verdict: "unknown" },
      });
    }
    const data = await resp.json();
    const listed = data?.query_status !== "no_results" && !!data?.url_status;
    const urlStatus = data?.url_status || null;
    const threat = data?.threat || null;

    if (!listed) {
      return finalize({
        provider: "urlhaus",
        provider_label: "URLhaus (abuse.ch)",
        status: "pass",
        summary: "Not listed in URLhaus malware database",
        weight: 30,
        score_impact: 10,
        payload: { listed: false, verdict: "clear" },
      });
    }
    const active = urlStatus === "online";
    return finalize({
      provider: "urlhaus",
      provider_label: "URLhaus (abuse.ch)",
      status: active ? "fail" : "warn",
      summary: active
        ? `Active malware listing in URLhaus${threat ? ` (${threat})` : ""}`
        : `Previously listed in URLhaus${threat ? ` (${threat})` : ""}`,
      weight: 30,
      score_impact: active ? -60 : -20,
      payload: { listed: true, url_status: urlStatus, threat, verdict: active ? "danger" : "warning", critical: active },
    });
  } catch (err) {
    console.error("[scan-core] URLhaus failed (fail-soft):", err);
    return finalize({
      provider: "urlhaus",
      provider_label: "URLhaus (abuse.ch)",
      status: "unknown",
      summary: "URLhaus check unavailable",
      weight: 30,
      score_impact: 0,
      payload: { error: "unavailable", verdict: "unknown" },
    });
  }
}

async function runLinkIntel(url: string): Promise<EvidenceCard> {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const registrable = getRegistrable(domain);

    const isShortlink = SHORTLINK_DOMAINS.has(domain) || SHORTLINK_DOMAINS.has(registrable);

    const suspiciousParams: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (SUSPICIOUS_QUERY_KEYS.has(key.toLowerCase())) suspiciousParams.push(key);
    });

    const baitMatches: string[] = [];
    for (const re of BAIT_PATH_PATTERNS) {
      const m = parsed.pathname.match(re);
      if (m) baitMatches.push(m[0].toLowerCase());
    }

    let redirectHops = 0;
    let finalUrl = url;
    try {
      const chain: string[] = [];
      let current = url;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      try {
        for (let i = 0; i < 5; i++) {
          const r = await fetch(current, {
            method: "HEAD",
            redirect: "manual",
            signal: ctrl.signal,
          });
          chain.push(current);
          const status = r.status;
          const loc = r.headers.get("location");
          if (status >= 300 && status < 400 && loc) {
            redirectHops++;
            current = new URL(loc, current).toString();
            continue;
          }
          finalUrl = current;
          break;
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (_err) {
      // fail-soft, keep redirectHops = 0
    }

    const finalDomain = (() => {
      try { return new URL(finalUrl).hostname.replace(/^www\./, ""); } catch { return domain; }
    })();
    const crossDomain = finalDomain !== domain;

    const problems: string[] = [];
    let impact = 10;
    let status: EvidenceStatus = "pass";

    if (isShortlink) {
      problems.push("Shortlink hides final destination");
      impact -= 15;
      status = "warn";
    }
    if (redirectHops >= 2) {
      problems.push(`${redirectHops} redirect hops before final page`);
      impact -= 10;
      status = "warn";
    }
    if (crossDomain && isShortlink === false) {
      problems.push(`Redirects to different domain (${finalDomain})`);
      impact -= 10;
      status = "warn";
    }
    if (suspiciousParams.length > 0) {
      problems.push(`Suspicious query params: ${suspiciousParams.slice(0, 3).join(", ")}`);
      impact -= 12;
      status = "warn";
    }
    if (baitMatches.length >= 2) {
      problems.push(`Phishing bait path patterns: ${baitMatches.slice(0, 2).join(", ")}`);
      impact -= 20;
      status = "fail";
    } else if (baitMatches.length === 1) {
      problems.push(`Bait-style path keyword: ${baitMatches[0]}`);
      impact -= 8;
      if (status === "pass") status = "warn";
    }

    const summary = problems.length === 0
      ? "Link structure looks clean, no redirect or bait patterns"
      : problems[0];

    return finalize({
      provider: "link_intel",
      provider_label: "Link Intel",
      status,
      summary,
      weight: 25,
      score_impact: impact,
      payload: {
        is_shortlink: isShortlink,
        redirect_hops: redirectHops,
        final_url: finalUrl,
        final_domain: finalDomain,
        cross_domain: crossDomain,
        suspicious_params: suspiciousParams,
        bait_matches: baitMatches,
        problems,
        verdict: status === "fail" ? "danger" : status === "warn" ? "warning" : "clear",
        critical: baitMatches.length >= 2,
      },
    });
  } catch (err) {
    console.error("[scan-core] LinkIntel failed (fail-soft):", err);
    return finalize({
      provider: "link_intel",
      provider_label: "Link Intel",
      status: "unknown",
      summary: "Link structure check unavailable",
      weight: 25,
      score_impact: 0,
      payload: { error: "unavailable", verdict: "unknown" },
    });
  }
}

async function runDomainIntel(url: string): Promise<EvidenceCard> {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const registrable = getRegistrable(domain);
    const tld = getTld(domain);

    const isPunycode = domain.includes("xn--");
    const suspiciousTld = SUSPICIOUS_TLDS.has(tld);
    const lookalike = detectLookalikeBrand(domain);
    const subdomainCount = domain.split(".").length - registrable.split(".").length;
    const digitRatio = (registrable.match(/[0-9]/g) || []).length / Math.max(registrable.length, 1);
    const hyphenCount = (registrable.match(/-/g) || []).length;

    let ageDays: number | null = null;
    try {
      const rdapResp = await fetch(`https://rdap.org/domain/${encodeURIComponent(registrable)}`, {
        signal: AbortSignal.timeout(4000),
        headers: { Accept: "application/rdap+json" },
      });
      if (rdapResp.ok) {
        const rdap = await rdapResp.json();
        const events: Array<{ eventAction: string; eventDate: string }> = rdap?.events || [];
        const reg = events.find((e) => e.eventAction === "registration");
        if (reg?.eventDate) {
          const d = new Date(reg.eventDate).getTime();
          if (!Number.isNaN(d)) ageDays = Math.floor((Date.now() - d) / 86400000);
        }
      }
    } catch (_err) {
      // fail-soft
    }

    const problems: string[] = [];
    let impact = 10;
    let status: EvidenceStatus = "pass";
    let critical = false;

    if (lookalike) {
      problems.push(`Domain looks like "${lookalike.brand}" (possible impersonation)`);
      impact -= 35;
      status = "fail";
      critical = true;
    }
    if (isPunycode) {
      problems.push("Punycode / IDN homograph detected");
      impact -= 25;
      if (status !== "fail") status = "fail";
      critical = true;
    }
    if (suspiciousTld) {
      problems.push(`Suspicious TLD: .${tld}`);
      impact -= 12;
      if (status === "pass") status = "warn";
    }
    if (ageDays !== null && ageDays < 30) {
      problems.push(`Very new domain (registered ${ageDays} day${ageDays === 1 ? "" : "s"} ago)`);
      impact -= 20;
      status = "fail";
    } else if (ageDays !== null && ageDays < 180) {
      problems.push(`Young domain (${ageDays} days old)`);
      impact -= 8;
      if (status === "pass") status = "warn";
    } else if (ageDays !== null && ageDays >= 365 * 2) {
      impact += 5;
    }
    if (subdomainCount >= 3) {
      problems.push(`Excessive subdomains (${subdomainCount})`);
      impact -= 8;
      if (status === "pass") status = "warn";
    }
    if (digitRatio > 0.3 && registrable.length > 6) {
      problems.push("Digit-heavy domain");
      impact -= 6;
      if (status === "pass") status = "warn";
    }
    if (hyphenCount >= 3) {
      problems.push("Unusual hyphen pattern in domain");
      impact -= 5;
      if (status === "pass") status = "warn";
    }

    const summary = problems.length === 0
      ? (ageDays !== null
          ? `Established domain (${Math.floor(ageDays / 30)} mo), no lookalike or TLD red flags`
          : "Domain structure clean, no lookalike or suspicious TLD")
      : problems[0];

    return finalize({
      provider: "domain_intel",
      provider_label: "Domain Intel",
      status,
      summary,
      weight: 30,
      score_impact: impact,
      payload: {
        domain,
        registrable,
        tld,
        punycode: isPunycode,
        suspicious_tld: suspiciousTld,
        lookalike_brand: lookalike?.brand ?? null,
        lookalike_distance: lookalike?.distance ?? null,
        age_days: ageDays,
        subdomain_count: subdomainCount,
        digit_ratio: Number(digitRatio.toFixed(2)),
        hyphen_count: hyphenCount,
        problems,
        verdict: status === "fail" ? "danger" : status === "warn" ? "warning" : "clear",
        critical,
      },
    });
  } catch (err) {
    console.error("[scan-core] DomainIntel failed (fail-soft):", err);
    return finalize({
      provider: "domain_intel",
      provider_label: "Domain Intel",
      status: "unknown",
      summary: "Domain check unavailable",
      weight: 30,
      score_impact: 0,
      payload: { error: "unavailable", verdict: "unknown" },
    });
  }
}

function computeVerdict(evidence: EvidenceCard[]): {
  badge: Badge;
  score: number;
  trust_score: number;
  verdict: "clear" | "warning" | "danger" | "unknown";
  reason_codes: string[];
} {
  const reason_codes: string[] = [];
  const BASE_SCORE = 70;
  let score = BASE_SCORE;
  let criticalFail = false;
  let unknownCount = 0;
  let knownCount = 0;

  for (const e of evidence) {
    score += e.score_impact;
    if (e.status === "unknown") unknownCount++;
    else knownCount++;

    if (e.status === "fail") reason_codes.push(`${e.provider}:fail`);
    else if (e.status === "warn") reason_codes.push(`${e.provider}:warn`);
    else if (e.status === "unknown") reason_codes.push(`${e.provider}:unknown`);

    if (e.status === "fail" && (e.payload as { critical?: boolean })?.critical === true) {
      criticalFail = true;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const evidenceComplete = knownCount >= 3;
  const allUnknown = knownCount === 0 && unknownCount > 0;

  let badge: Badge;
  let verdict: "clear" | "warning" | "danger" | "unknown";

  if (criticalFail || score < 50) {
    badge = "HIGH_RISK";
    verdict = "danger";
  } else if (score >= 80 && evidenceComplete) {
    badge = "VERIFIED";
    verdict = "clear";
  } else {
    badge = "UNVERIFIED";
    verdict = allUnknown ? "unknown" : "warning";
  }

  if (allUnknown) reason_codes.push("providers_unavailable");
  if (!evidenceComplete && badge !== "HIGH_RISK") reason_codes.push("evidence_incomplete");
  if (reason_codes.length === 0) reason_codes.push("all_clear");

  const trust_score = Math.round((score / 100) * 100) / 100;

  return { badge, score, trust_score, verdict, reason_codes };
}

export interface RunScanOptions {
  supabase?: any;
  deviceId?: string;
  persist?: boolean;
}

export async function runScanCore(rawUrl: string, opts: RunScanOptions = {}): Promise<ScanCoreResult> {
  const traceId = generateTraceId();
  const normalized_url = normalizeUrl(rawUrl);
  const domain = extractDomain(normalized_url);

  const [webriskCard, urlhausCard, linkIntelCard, domainIntelCard] = await Promise.all([
    runWebRisk(normalized_url),
    runUrlhaus(normalized_url),
    runLinkIntel(normalized_url),
    runDomainIntel(normalized_url),
  ]);

  const evidence: EvidenceCard[] = [webriskCard, urlhausCard, linkIntelCard, domainIntelCard];
  const { badge, score, trust_score, verdict, reason_codes } = computeVerdict(evidence);

  const top_red_flags = evidence
    .filter((e) => e.status === "fail" || e.status === "warn")
    .sort((a, b) => {
      const order = { fail: 0, warn: 1, unknown: 2, pass: 3 } as const;
      return order[a.status] - order[b.status];
    })
    .slice(0, 3)
    .map((e) => e.summary);

  const next_action = computeNextAction(badge, score, top_red_flags);

  const providers: Record<string, unknown> = {};
  for (const e of evidence) {
    providers[e.provider] = { ...e.payload, verdict: e.payload.verdict ?? verdict };
  }

  const result: ScanCoreResult = {
    url: rawUrl,
    normalized_url,
    domain,
    badge,
    score,
    trust_score,
    verdict,
    reason_codes,
    providers,
    evidence,
    top_red_flags,
    next_action,
    trace_id: traceId,
    ts: new Date().toISOString(),
  };

  if (opts.persist !== false && opts.supabase) {
    try {
      const { data: inserted, error: insertErr } = await opts.supabase
        .from("scan_results")
        .insert({
          device_id: opts.deviceId || "system",
          url: rawUrl,
          final_url: normalized_url,
          normalized_url,
          domain,
          badge,
          score,
          summary: next_action,
          reasons: reason_codes,
          metrics: { trust_score, verdict },
          score_breakdown: { evidence: evidence.map((e) => ({ provider: e.provider, status: e.status, weight: e.weight, score_impact: e.score_impact })) },
          scan_version: "3.0",
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[scan-core] persist scan_results failed:", insertErr);
      } else if (inserted?.id) {
        (result as ScanCoreResult & { scan_id?: string }).scan_id = inserted.id;

        const providerMap: Record<string, string> = {
          google_webrisk: "google_safe_browsing",
          urlhaus: "link_intel",
          link_intel: "link_intel",
          domain_intel: "link_intel",
        };

        const evidenceRows = evidence.map((e) => ({
          scan_id: inserted.id,
          provider: providerMap[e.provider] || "link_intel",
          provider_label: e.provider_label,
          status: e.status,
          summary: e.summary,
          weight: e.weight,
          score_impact: e.score_impact,
          payload: e.payload,
          card_title: e.card_title,
          card_status: e.card_status,
          card_payload: e.card_payload,
        }));

        const { error: evErr } = await opts.supabase
          .from("scan_evidence")
          .insert(evidenceRows);
        if (evErr) console.error("[scan-core] persist scan_evidence failed:", evErr);
      }

      const cacheKey = `scan:${normalized_url}`;
      const cacheValue = {
        badge,
        score,
        verdict,
        trust_score,
        reason_codes,
        top_red_flags,
        next_action,
        evidence,
        domain,
        normalized_url,
        scan_id: (result as ScanCoreResult & { scan_id?: string }).scan_id ?? null,
      };
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: cacheErr } = await opts.supabase
        .from("scan_cache")
        .upsert({ key: cacheKey, value: cacheValue, expires_at: expiresAt }, { onConflict: "key" });
      if (cacheErr) console.error("[scan-core] persist scan_cache failed:", cacheErr);
    } catch (err) {
      console.error("[scan-core] persistence error (non-fatal):", err);
    }
  }

  return result;
}

export async function getOrRunScan(rawUrl: string, supabase: any, deviceId?: string): Promise<ScanCoreResult & { scan_id?: string; cache_hit: boolean }> {
  const normalized_url = normalizeUrl(rawUrl);
  const cacheKey = `scan:${normalized_url}`;

  if (supabase) {
    const { data: cached } = await supabase
      .from("scan_cache")
      .select("value, expires_at")
      .eq("key", cacheKey)
      .maybeSingle();

    if (cached && new Date(cached.expires_at) > new Date()) {
      const v = cached.value || {};
      const badge: Badge = v.badge || "UNVERIFIED";
      const score: number = typeof v.score === "number" ? v.score : 50;
      const top_red_flags: string[] = Array.isArray(v.top_red_flags) ? v.top_red_flags : [];
      const next_action: string = v.next_action || computeNextAction(badge, score, top_red_flags);

      return {
        url: rawUrl,
        normalized_url,
        domain: v.domain || extractDomain(normalized_url),
        badge,
        score,
        trust_score: typeof v.trust_score === "number" ? v.trust_score : score / 100,
        verdict: v.verdict || "unknown",
        reason_codes: Array.isArray(v.reason_codes) ? v.reason_codes : [],
        providers: {},
        evidence: Array.isArray(v.evidence) ? v.evidence : [],
        top_red_flags,
        next_action,
        trace_id: generateTraceId(),
        ts: new Date().toISOString(),
        scan_id: v.scan_id || undefined,
        cache_hit: true,
      };
    }
  }

  const fresh = await runScanCore(rawUrl, { supabase, deviceId, persist: true });
  return { ...fresh, scan_id: (fresh as ScanCoreResult & { scan_id?: string }).scan_id, cache_hit: false };
}
