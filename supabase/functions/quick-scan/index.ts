// @ts-nocheck
// Supabase Edge Function: quick-scan
// GET /quick-scan?url=<url> - Fast cached scan for browser extensions
// Returns: { badge, score, top_red_flags, scan_id }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.split("/")[0].replace(/^www\./, "");
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);

  if (reqUrl.searchParams.get("health") !== null) {
    return new Response(JSON.stringify({
      status: "ok",
      function: "quick-scan",
      secrets: {
        PROJECT_URL: !!Deno.env.get("PROJECT_URL"),
        SERVICE_ROLE_KEY: !!Deno.env.get("SERVICE_ROLE_KEY"),
      },
      verbose: VERBOSE,
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ message: "Method not allowed", code: "METHOD_NOT_ALLOWED", details: null, hint: "Use GET" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const targetUrl = reqUrl.searchParams.get("url");
    if (!targetUrl) {
      return new Response(JSON.stringify({ message: "url query parameter is required", code: "INVALID_INPUT", details: null, hint: null }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      return new Response(JSON.stringify({
        badge: v.badge,
        score: v.score,
        top_red_flags: topRedFlags,
        scan_id: null,
        cache_hit: true,
        domain: v.domain,
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
      return new Response(JSON.stringify({
        badge: recentScan.badge,
        score: recentScan.score,
        top_red_flags: topRedFlags,
        scan_id: recentScan.id,
        cache_hit: false,
        domain: recentScan.domain,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[quick-scan] No cached/recent scan for:", targetUrl);
    return new Response(JSON.stringify({
      badge: null,
      score: null,
      top_red_flags: [],
      scan_id: null,
      cache_hit: false,
      domain,
      message: "No existing scan found. Use POST /content-scan to run a full scan.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[quick-scan] Error:", error);
    const errObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      message: errObj.message,
      code: (error as any)?.code ?? "INTERNAL_ERROR",
      details: (error as any)?.details ?? null,
      hint: (error as any)?.hint ?? null,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
