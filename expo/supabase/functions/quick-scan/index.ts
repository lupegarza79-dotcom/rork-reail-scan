// @ts-nocheck
// Supabase Edge Function: quick-scan
// Thin HTTP wrapper around scan-core.
// GET/POST /quick-scan?url= - Fast multi-provider scan
// Returns: { url, providers, trust, ts, rate_limit }

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { getClientIp, getDeviceId, getProjectUrl, getServiceRoleKey } from "../_shared/auth.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { logTelemetry } from "../_shared/telemetry.ts";
import { getOrRunScan } from "../_shared/scan-core.ts";

const ENDPOINT = "quick-scan";
const QUICK_SCAN_RATE_LIMIT = 120;
const RATE_LIMIT_WINDOW_MINUTES = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const requestUrl = new URL(req.url);

  if (requestUrl.searchParams.get("health") !== null || requestUrl.pathname.endsWith("/health")) {
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
        return rateLimitResponse(ENDPOINT, rateCheck);
      }
    }

    const result = await getOrRunScan(url, supabase, deviceId);

    if (supabase) {
      void logTelemetry(supabase, [
        {
          trace_id: result.trace_id,
          endpoint: ENDPOINT,
          event_type: "scan",
          device_id: deviceId,
          ip,
          status: "ok",
          latency_ms: Date.now() - startTime,
          success: true,
          score: result.score,
          badge: result.verdict,
        },
      ]);
    }

    return jsonResponse({
      url: result.url,
      normalized_url: result.normalized_url,
      providers: result.providers,
      trust: {
        score: result.trust_score,
        verdict: result.verdict,
        reason: result.reason_codes.join("; "),
        reason_codes: result.reason_codes,
      },
      badge: result.badge,
      score: result.score,
      top_red_flags: result.top_red_flags,
      next_action: result.next_action,
      evidence: result.evidence,
      scan_id: (result as { scan_id?: string }).scan_id ?? null,
      cache_hit: result.cache_hit,
      trace_id: result.trace_id,
      ts: result.ts,
    });
  } catch (err) {
    console.error("[quick-scan] Error:", err);
    return jsonResponse({ ok: false, error_code: "internal_error", message: String((err as Error)?.message ?? err), endpoint: ENDPOINT }, 500);
  }
});
