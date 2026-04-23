// @ts-nocheck
// Shared scan core — used by quick-scan (HTTP wrapper) and wallet-share (internal).
// Guarantees an evidence-backed verdict on every call: badge, score, next_action
// are never null, top_red_flags is always an array.

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

export function computeNextAction(badge: Badge, score: number, redFlags: string[]): string {
  if (badge === "HIGH_RISK" || score < 40) {
    return "Do NOT click this link. It shows signs of a scam or phishing attempt.";
  }
  if (badge === "UNVERIFIED" || score < 70) {
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

async function runWebRisk(url: string): Promise<EvidenceCard> {
  try {
    const result = await Promise.race([
      webRiskLookup(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]) as { threatTypes: string[] };

    const threats = result.threatTypes || [];
    if (threats.length === 0) {
      return {
        provider: "google_webrisk",
        provider_label: "Google Web Risk",
        status: "pass",
        summary: "No known threats detected by Google Web Risk",
        weight: 40,
        score_impact: 35,
        payload: { threatTypes: [], verdict: "clear" },
      };
    }
    const isDanger = threats.includes("MALWARE") || threats.includes("SOCIAL_ENGINEERING");
    return {
      provider: "google_webrisk",
      provider_label: "Google Web Risk",
      status: isDanger ? "fail" : "warn",
      summary: isDanger
        ? `Flagged by Google Web Risk: ${threats.join(", ")}`
        : `Listed by Google Web Risk: ${threats.join(", ")}`,
      weight: 40,
      score_impact: isDanger ? -50 : -25,
      payload: { threatTypes: threats, verdict: isDanger ? "danger" : "warning" },
    };
  } catch (err) {
    console.error("[scan-core] WebRisk failed (fail-soft):", err);
    return {
      provider: "google_webrisk",
      provider_label: "Google Web Risk",
      status: "unknown",
      summary: "Google Web Risk check unavailable",
      weight: 40,
      score_impact: 0,
      payload: { error: "unavailable", verdict: "unknown" },
    };
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
      return {
        provider: "urlhaus",
        provider_label: "URLhaus (abuse.ch)",
        status: "unknown",
        summary: "URLhaus check unavailable",
        weight: 30,
        score_impact: 0,
        payload: { error: "api_error", verdict: "unknown" },
      };
    }
    const data = await resp.json();
    const listed = data?.query_status !== "no_results" && !!data?.url_status;
    const urlStatus = data?.url_status || null;
    const threat = data?.threat || null;

    if (!listed) {
      return {
        provider: "urlhaus",
        provider_label: "URLhaus (abuse.ch)",
        status: "pass",
        summary: "Not listed in URLhaus malware database",
        weight: 30,
        score_impact: 25,
        payload: { listed: false, verdict: "clear" },
      };
    }
    const active = urlStatus === "online";
    return {
      provider: "urlhaus",
      provider_label: "URLhaus (abuse.ch)",
      status: active ? "fail" : "warn",
      summary: active
        ? `Active malware listing in URLhaus${threat ? ` (${threat})` : ""}`
        : `Previously listed in URLhaus${threat ? ` (${threat})` : ""}`,
      weight: 30,
      score_impact: active ? -40 : -15,
      payload: { listed: true, url_status: urlStatus, threat, verdict: active ? "danger" : "warning" },
    };
  } catch (err) {
    console.error("[scan-core] URLhaus failed (fail-soft):", err);
    return {
      provider: "urlhaus",
      provider_label: "URLhaus (abuse.ch)",
      status: "unknown",
      summary: "URLhaus check unavailable",
      weight: 30,
      score_impact: 0,
      payload: { error: "unavailable", verdict: "unknown" },
    };
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
  const hasFail = evidence.some((e) => e.status === "fail");
  const hasWarn = evidence.some((e) => e.status === "warn");
  const allUnknown = evidence.every((e) => e.status === "unknown");

  for (const e of evidence) {
    if (e.status === "fail") reason_codes.push(`${e.provider}:fail`);
    else if (e.status === "warn") reason_codes.push(`${e.provider}:warn`);
    else if (e.status === "unknown") reason_codes.push(`${e.provider}:unknown`);
  }

  if (hasFail) {
    return { badge: "HIGH_RISK", score: 10, trust_score: 0.0, verdict: "danger", reason_codes };
  }
  if (hasWarn) {
    return { badge: "UNVERIFIED", score: 45, trust_score: 0.3, verdict: "warning", reason_codes };
  }
  if (allUnknown) {
    return { badge: "UNVERIFIED", score: 50, trust_score: 0.5, verdict: "unknown", reason_codes: ["providers_unavailable"] };
  }
  if (reason_codes.length === 0) reason_codes.push("all_clear");
  return { badge: "VERIFIED", score: 85, trust_score: 0.9, verdict: "clear", reason_codes };
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

  const [webriskCard, urlhausCard] = await Promise.all([
    runWebRisk(normalized_url),
    runUrlhaus(normalized_url),
  ]);

  const evidence: EvidenceCard[] = [webriskCard, urlhausCard];
  const { badge, score, trust_score, verdict, reason_codes } = computeVerdict(evidence);

  const top_red_flags = evidence
    .filter((e) => e.status === "fail" || e.status === "warn")
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
          scan_version: "2.0",
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("[scan-core] persist scan_results failed:", insertErr);
      } else if (inserted?.id) {
        (result as ScanCoreResult & { scan_id?: string }).scan_id = inserted.id;

        const evidenceRows = evidence.map((e) => ({
          scan_id: inserted.id,
          provider: e.provider === "google_webrisk" ? "google_safe_browsing" : "link_intel",
          provider_label: e.provider_label,
          status: e.status,
          summary: e.summary,
          weight: e.weight,
          score_impact: e.score_impact,
          payload: e.payload,
          card_title: e.provider_label,
          card_status: e.status,
          card_payload: { summary: e.summary, ...e.payload },
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
        trust_score: typeof v.trust_score === "number" ? v.trust_score : 0.5,
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
