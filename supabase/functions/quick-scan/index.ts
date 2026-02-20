// @ts-nocheck
// Supabase Edge Function: quick-scan
// GET/POST /quick-scan?url= - Fast multi-provider scan
// Returns: { url, providers, trust, ts, rate_limit }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { webRiskLookup } from "../_shared/webrisk.ts";
import { corsHeaders, corsResponse, jsonResponse } from "../_shared/cors.ts";
import { getClientIp, getDeviceId, getProjectUrl, getServiceRoleKey } from "../_shared/auth.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { logTelemetry, generateTraceId } from "../_shared/telemetry.ts";

const ENDPOINT = "quick-scan";
const QUICK_SCAN_RATE_LIMIT = 120;
const RATE_LIMIT_WINDOW_MINUTES = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const requestUrl = new URL(req.url);

  if (requestUrl.searchParams.get("health") !== null) {
    return jsonResponse({
      ok: true,
      endpoint: ENDPOINT,
      details: {
        secrets: {
          PROJECT_URL: !!getProjectUrl(),
          SERVICE_ROLE_KEY: !!getServiceRoleKey(),
          GOOGLE_WEBRISK_API_KEY: !!Deno.env.get("GOOGLE_WEBRISK_API_KEY"),
          URLSCAN_API_KEY: !!Deno.env.get("URLSCAN_API_KEY"),
        },
      },
      timestamp: new Date().toISOString(),
    });
  }

  const startTime = Date.now();
  const traceId = generateTraceId();

  try {
    let url: string | null = null;

    if (req.method === "GET") {
      url = requestUrl.searchParams.get("url");
    } else {
      const body = await req.json().catch(() => ({}));
      url = typeof body?.url === "string" ? body.url : null;
    }

    if (!url) {
      return jsonResponse({ ok: false, error_code: "invalid_input", message: "Missing 'url'", endpoint: ENDPOINT }, 400);
    }

    const deviceId = getDeviceId(req);
    const ip = getClientIp(req);

    const supabaseUrl = getProjectUrl();
    const supabaseKey = getServiceRoleKey();
    let supabase: any = null;

    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

      const rateCheck = await checkRateLimit(supabase, ENDPOINT, deviceId, ip, QUICK_SCAN_RATE_LIMIT, RATE_LIMIT_WINDOW_MINUTES);
      if (!rateCheck.allowed) {
        void logTelemetry(supabase, {
          trace_id: traceId,
          endpoint: ENDPOINT,
          event_type: "scan",
          device_id: deviceId,
          ip,
          status: "rate_limited",
          latency_ms: Date.now() - startTime,
        });
        return rateLimitResponse(ENDPOINT, rateCheck);
      }
    }

    const providers: Record<string, unknown> = {};
    const providerTelemetry: Record<string, unknown>[] = [];

    const webriskPromise = (async () => {
      const pStart = Date.now();
      try {
        const result = await webRiskLookup(url!);
        providerTelemetry.push({ endpoint: ENDPOINT, event_type: "provider", provider: "google_webrisk", latency_ms: Date.now() - pStart, status: "ok", success: true, device_id: deviceId, ip, trace_id: traceId });
        const verdict = result.threatTypes.length === 0 ? "clear"
          : result.threatTypes.includes("MALWARE") ? "danger"
          : result.threatTypes.includes("SOCIAL_ENGINEERING") ? "danger"
          : "warning";
        providers.google_webrisk = { threatTypes: result.threatTypes, verdict };
        return { verdict, threatTypes: result.threatTypes };
      } catch (err) {
        console.error("[quick-scan] WebRisk failed (fail-soft):", err);
        providerTelemetry.push({ endpoint: ENDPOINT, event_type: "provider", provider: "google_webrisk", latency_ms: Date.now() - pStart, status: "error", success: false, error_code: "PROVIDER_ERROR", device_id: deviceId, ip, trace_id: traceId });
        providers.google_webrisk = { error: "unavailable", verdict: "unknown" };
        return { verdict: "unknown", threatTypes: [] };
      }
    })();

    const urlhausPromise = (async () => {
      const pStart = Date.now();
      try {
        const resp = await fetch("https://urlhaus-api.abuse.ch/v1/url/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `url=${encodeURIComponent(url!)}`,
          signal: AbortSignal.timeout(5000),
        });
        providerTelemetry.push({ endpoint: ENDPOINT, event_type: "provider", provider: "urlhaus", latency_ms: Date.now() - pStart, status: resp.ok ? "ok" : "error", success: resp.ok, device_id: deviceId, ip, trace_id: traceId });
        if (resp.ok) {
          const data = await resp.json();
          const listed = data?.query_status !== "no_results" && !!data?.url_status;
          const threat = data?.threat || null;
          const urlStatus = data?.url_status || null;
          providers.urlhaus = { listed, threat, url_status: urlStatus, verdict: listed && urlStatus === "online" ? "danger" : listed ? "warning" : "clear" };
          return { listed, urlStatus };
        }
        providers.urlhaus = { error: "api_error", verdict: "unknown" };
        return { listed: false, urlStatus: null };
      } catch (err) {
        console.error("[quick-scan] URLhaus failed (fail-soft):", err);
        providerTelemetry.push({ endpoint: ENDPOINT, event_type: "provider", provider: "urlhaus", latency_ms: Date.now() - pStart, status: "error", success: false, error_code: "PROVIDER_ERROR", device_id: deviceId, ip, trace_id: traceId });
        providers.urlhaus = { error: "unavailable", verdict: "unknown" };
        return { listed: false, urlStatus: null };
      }
    })();

    const [webriskResult, urlhausResult] = await Promise.allSettled([webriskPromise, urlhausPromise]);

    const wr = webriskResult.status === "fulfilled" ? webriskResult.value : { verdict: "unknown", threatTypes: [] };
    const uh = urlhausResult.status === "fulfilled" ? urlhausResult.value : { listed: false, urlStatus: null };

    let finalVerdict = "clear";
    let trustScore = 0.90;
    const reasonCodes: string[] = [];

    if (wr.verdict === "danger" || (uh.listed && uh.urlStatus === "online")) {
      finalVerdict = "danger";
      trustScore = 0.00;
      if (wr.verdict === "danger") reasonCodes.push("webrisk_threat:" + wr.threatTypes.join(","));
      if (uh.listed && uh.urlStatus === "online") reasonCodes.push("urlhaus_active_threat");
    } else if (wr.verdict === "warning" || uh.listed) {
      finalVerdict = "warning";
      trustScore = 0.30;
      if (wr.verdict === "warning") reasonCodes.push("webrisk_warning");
      if (uh.listed) reasonCodes.push("urlhaus_previously_listed");
    } else {
      reasonCodes.push("all_clear");
    }

    if (supabase) {
      void logTelemetry(supabase, [
        {
          trace_id: traceId,
          endpoint: ENDPOINT,
          event_type: "scan",
          device_id: deviceId,
          ip,
          status: "ok",
          latency_ms: Date.now() - startTime,
          success: true,
          score: Math.round(trustScore * 100),
          badge: finalVerdict,
        },
        ...providerTelemetry,
      ]);
    }

    return jsonResponse({
      url,
      providers,
      trust: {
        score: trustScore,
        verdict: finalVerdict,
        reason: reasonCodes.join("; "),
        reason_codes: reasonCodes,
      },
      trace_id: traceId,
      ts: new Date().toISOString(),
    });

  } catch (err) {
    console.error("[quick-scan] Error:", err);
    return jsonResponse({ ok: false, error_code: "internal_error", message: String(err?.message ?? err), endpoint: ENDPOINT }, 500);
  }
});
