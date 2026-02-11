// @ts-nocheck
// Supabase Edge Function: cache-cleanup
<<<<<<< HEAD
// POST /cache-cleanup - Runs cleanup_expired_cache() and returns deleted count
=======
//
// Comprehensive scheduled cleanup for all ephemeral data:
// - scan_cache (expired entries)
// - wallet_share_links (expired share links)
// - rate_limits (stale windows)
// - scan_telemetry_events (retention purge, default 30 days)
//
// GET  => health-check
// POST => run all cleanup via run_all_cleanup() RPC
//
// Schedule: cron(0 */3 * * *) -- every 3 hours
>>>>>>> origin/main

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

<<<<<<< HEAD
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
=======
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
>>>>>>> origin/main
};

const ENDPOINT = "cache-cleanup";
const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

<<<<<<< HEAD
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (req.method === "GET" && url.searchParams.get("health") !== null) {
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
=======
function getSupabase() {
  const url = Deno.env.get("PROJECT_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    throw new Error("Missing PROJECT_URL/SUPABASE_URL or SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = Deno.env.get("PROJECT_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const key = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const secretsOk = Boolean(url && key);

    return new Response(JSON.stringify({
      ok: secretsOk,
      endpoint: ENDPOINT,
      details: {
        env: {
          project_url: !!url,
          service_role_key: !!key,
        },
        schedule: "cron(0 */3 * * *)",
        cleans: ["scan_cache", "wallet_share_links", "rate_limits", "scan_telemetry_events"],
      },
      timestamp: new Date().toISOString(),
    }), {
      status: secretsOk ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
>>>>>>> origin/main
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      ok: false,
<<<<<<< HEAD
      error_code: "method_not_allowed",
      message: "Method not allowed",
      endpoint: ENDPOINT,
    }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc("cleanup_expired_cache");
    if (error) {
      console.error("[cache-cleanup] RPC error:", error);
      throw error;
    }

    const deleted = typeof data === "number" ? data : Number(data || 0);
    return new Response(JSON.stringify({ ok: true, deleted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cache-cleanup] Error:", error);
    const errObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      ok: false,
      error_code: (error as any)?.code ?? "internal_error",
      message: errObj.message,
      endpoint: ENDPOINT,
=======
      endpoint: ENDPOINT,
      error_code: "method_not_allowed",
      message: "Use POST to run cleanup, GET for health check.",
    }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("authorization");
  const svcKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearerToken = authHeader?.replace("Bearer ", "") ?? "";
  if (!svcKey || bearerToken !== svcKey) {
    return new Response(JSON.stringify({
      ok: false,
      endpoint: ENDPOINT,
      error_code: "forbidden",
      message: "This endpoint requires service-role authorization",
    }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const startTime = Date.now();
  try {
    const supabase = getSupabase();

    // Try the unified run_all_cleanup() RPC first
    const { data: unified, error: unifiedErr } = await supabase.rpc("run_all_cleanup");

    if (!unifiedErr && unified) {
      const latency = Date.now() - startTime;
      if (VERBOSE) {
        console.log(`[${ENDPOINT}] run_all_cleanup completed in ${latency}ms:`, unified);
      }
      return new Response(JSON.stringify({
        ok: true,
        endpoint: ENDPOINT,
        method: "unified",
        result: unified,
        latency_ms: latency,
        timestamp: new Date().toISOString(),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fallback: run each cleanup individually
    if (VERBOSE) {
      console.log(`[${ENDPOINT}] run_all_cleanup not available, running individually`);
    }

    const results: Record<string, number | string> = {};

    const { data: cacheResult, error: cacheErr } = await supabase.rpc("cleanup_expired_cache");
    if (cacheErr) {
      console.log(`[${ENDPOINT}] cleanup_expired_cache error:`, cacheErr.message);
      results.cache = "error";
    } else {
      results.cache_deleted = typeof cacheResult === "number" ? cacheResult : 0;
    }

    const { data: shareResult, error: shareErr } = await supabase.rpc("cleanup_expired_share_links");
    if (shareErr) {
      console.log(`[${ENDPOINT}] cleanup_expired_share_links error:`, shareErr.message);
      results.share_links = "error";
    } else {
      results.share_links_deleted = typeof shareResult === "number" ? shareResult : 0;
    }

    const { data: rateResult, error: rateErr } = await supabase.rpc("cleanup_old_rate_limits");
    if (rateErr) {
      console.log(`[${ENDPOINT}] cleanup_old_rate_limits error:`, rateErr.message);
      results.rate_limits = "error";
    } else {
      results.rate_limits_deleted = typeof rateResult === "number" ? rateResult : 0;
    }

    const { data: telemResult, error: telemErr } = await supabase.rpc("cleanup_old_telemetry", { retention_days: 30 });
    if (telemErr) {
      console.log(`[${ENDPOINT}] cleanup_old_telemetry error:`, telemErr.message);
      results.telemetry = "error";
    } else {
      results.telemetry_deleted = typeof telemResult === "number" ? telemResult : 0;
    }

    const latency = Date.now() - startTime;
    if (VERBOSE) {
      console.log(`[${ENDPOINT}] Individual cleanup completed in ${latency}ms:`, results);
    }

    return new Response(JSON.stringify({
      ok: true,
      endpoint: ENDPOINT,
      method: "individual",
      result: results,
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error(`[${ENDPOINT}] Error:`, err);
    return new Response(JSON.stringify({
      ok: false,
      endpoint: ENDPOINT,
      error_code: "unexpected_error",
      message: err instanceof Error ? err.message : "Unexpected error during cleanup",
      latency_ms: Date.now() - startTime,
>>>>>>> origin/main
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
