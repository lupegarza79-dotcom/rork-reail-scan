// @ts-nocheck
// Supabase Edge Function: quick-scan
// GET /quick-scan?url=<url> - Fast cached scan for browser extensions
// Returns: { badge, score, top_red_flags, scan_id }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ENDPOINT = "quick-scan";
const QUICK_SCAN_RATE_LIMIT = 120;
const RATE_LIMIT_WINDOW_MINUTES = 60;

const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.split("/")[0].replace(/^www\./, "");
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}

async function logTelemetry(supabase: any, payload: Record<string, unknown>) {
  try {
    await supabase.from("scan_telemetry_events").insert(payload);
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);

  if (reqUrl.searchParams.get("health") !== null) {
    return new Response(JSON.stringify({
      ok: true,
      endpoint: ENDPOINT,
      details: {
        secrets: {
          PROJECT_URL: !!Deno.env.get("PROJECT_URL"),
          SERVICE_ROLE_KEY: !!Deno.env.get("SERVICE_ROLE_KEY"),
        },
        verbose: VERBOSE,
      },
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

<<<<<<< HEAD
  if (req.method !== "GET") {
    return new Response(JSON.stringify({
      ok: false,
      error_code: "method_not_allowed",
      message: "Method not allowed",
=======
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({
      ok: false,
      error_code: "method_not_allowed",
      message: "Method not allowed. Use GET or POST.",
>>>>>>> origin/main
      endpoint: ENDPOINT,
    }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  try {
    let targetUrl: string | null = null;
    let inputType = "url";
    let shareRequested = false;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        targetUrl = body.input || body.url || null;
        inputType = body.input_type || "url";
        shareRequested = !!body.share;
      } catch {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "invalid_body",
          message: "Invalid JSON body",
          endpoint: ENDPOINT,
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      targetUrl = reqUrl.searchParams.get("url");
    }

    if (!targetUrl) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
<<<<<<< HEAD
        message: "url query parameter is required",
=======
        message: req.method === "POST" ? "'input' field is required in body" : "url query parameter is required",
>>>>>>> origin/main
        endpoint: ENDPOINT,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const deviceId = req.headers.get("x-device-id") || "anonymous";
    const ip = getClientIp(req);

    const rateCheck = await checkRateLimit(
      supabase,
      ENDPOINT,
      deviceId,
      ip,
      QUICK_SCAN_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MINUTES,
    );
    if (!rateCheck.allowed) {
      void logTelemetry(supabase, {
        endpoint: ENDPOINT,
        event_type: "scan",
        device_id: deviceId,
        ip,
        status: "rate_limited",
        latency_ms: Date.now() - startTime,
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

    const cacheKey = `scan:${targetUrl}`;
    const { data: cached } = await supabase
      .from("scan_cache")
      .select("value, expires_at")
      .eq("key", cacheKey)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      const v = cached.value;
      const topRedFlags = (v.evidence || [])
        .filter((e: any) => e.status === "fail" || e.status === "warn")
        .slice(0, 3)
        .map((e: any) => e.summary);

      console.log("[quick-scan] Cache HIT for:", targetUrl);
      void logTelemetry(supabase, {
        endpoint: ENDPOINT,
        event_type: "scan",
        device_id: deviceId,
        ip,
        score: v.score,
        badge: v.badge,
        cache_hit: true,
        status: "ok",
        latency_ms: Date.now() - startTime,
        success: true,
      });
      return new Response(JSON.stringify({
        ok: true,
        badge: v.badge,
        score: v.score,
        top_red_flags: topRedFlags,
        scan_id: null,
        cache_hit: true,
        domain: v.domain,
        rate_limit: {
          remaining: rateCheck.remaining,
          limit: rateCheck.limit,
          window_seconds: rateCheck.windowSeconds,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const domain = extractDomain(targetUrl);
    const { data: recentScan } = await supabase
      .from("scan_results")
      .select("id, badge, score, summary, domain")
      .eq("domain", domain)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentScan) {
      const { data: evidenceRows } = await supabase
        .from("scan_evidence")
        .select("card_status, card_payload")
        .eq("scan_id", recentScan.id);

      const topRedFlags = (evidenceRows || [])
        .filter((r: any) => r.card_status === "fail" || r.card_status === "warn")
        .slice(0, 3)
        .map((r: any) => r.card_payload?.summary || "Flag detected");

      console.log("[quick-scan] DB HIT for:", targetUrl, "scan:", recentScan.id);
      void logTelemetry(supabase, {
        endpoint: ENDPOINT,
        event_type: "scan",
        device_id: deviceId,
        ip,
        scan_id: recentScan.id,
        score: recentScan.score,
        badge: recentScan.badge,
        cache_hit: false,
        status: "ok",
        latency_ms: Date.now() - startTime,
        success: true,
      });
      return new Response(JSON.stringify({
        ok: true,
        badge: recentScan.badge,
        score: recentScan.score,
        top_red_flags: topRedFlags,
        scan_id: recentScan.id,
        cache_hit: false,
        domain: recentScan.domain,
        rate_limit: {
          remaining: rateCheck.remaining,
          limit: rateCheck.limit,
          window_seconds: rateCheck.windowSeconds,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[quick-scan] No cached/recent scan for:", targetUrl);
    void logTelemetry(supabase, {
      endpoint: ENDPOINT,
      event_type: "scan",
      device_id: deviceId,
      ip,
      cache_hit: false,
      status: "ok",
      latency_ms: Date.now() - startTime,
      success: true,
    });
    return new Response(JSON.stringify({
      ok: true,
      badge: null,
      score: null,
      top_red_flags: [],
      scan_id: null,
      cache_hit: false,
      domain,
      rate_limit: {
        remaining: rateCheck.remaining,
        limit: rateCheck.limit,
        window_seconds: rateCheck.windowSeconds,
      },
      message: "No existing scan found. Use POST /content-scan to run a full scan.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[quick-scan] Error:", error);
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
