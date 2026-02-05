// @ts-nocheck
// Supabase Edge Function: scan-history
// GET /scan/history - Returns scan history for a device
// Returns: { items: ScanHistoryItem[] }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-device-id, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

function log(...args: unknown[]) {
  if (VERBOSE) console.log("[scan-history][verbose]", ...args);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("health") !== null) {
    const hasProjectUrl = !!Deno.env.get("PROJECT_URL");
    const hasServiceKey = !!Deno.env.get("SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({
      status: "ok",
      function: "scan-history",
      secrets: { PROJECT_URL: hasProjectUrl, SERVICE_ROLE_KEY: hasServiceKey },
      verbose: VERBOSE,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  try {
    const url = new URL(req.url);
    const deviceId = req.headers.get("x-device-id");
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    
    if (!deviceId) {
      return new Response(JSON.stringify({ error: "x-device-id header is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("[scan-history] Fetching history for device:", deviceId, "limit:", limit, "offset:", offset);
    
    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: scans, error: scansError, count } = await supabase
      .from("scan_results")
      .select("id, url, domain, title, badge, score, summary, created_at", { count: "exact" })
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (scansError) {
      console.error("[scan-history] DB error:", scansError);
      throw scansError;
    }
    
    const items = (scans || []).map(scan => ({
      scanId: scan.id,
      url: scan.url,
      domain: scan.domain,
      title: scan.title,
      badge: scan.badge,
      score: scan.score,
      summary: scan.summary,
      createdAt: scan.created_at,
    }));
    
    console.log("[scan-history] Found", items.length, "scans for device:", deviceId);
    
    return new Response(JSON.stringify({ 
      items,
      total: count || items.length,
      limit,
      offset,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[scan-history] Error:", error);
    const errObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: errObj.message,
      code: (error as any)?.code ?? null,
      details: (error as any)?.details ?? null,
      hint: (error as any)?.hint ?? null,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
