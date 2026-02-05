// @ts-nocheck
// Supabase Edge Function: scan-result
// GET /scan/result?scanId= - Returns full scan result with evidence
// Returns: BackendScanResult

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-device-id, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

function log(...args: unknown[]) {
  if (VERBOSE) console.log("[scan-result][verbose]", ...args);
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
      function: "scan-result",
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
    const scanId = url.searchParams.get("scanId");
    const deviceId = req.headers.get("x-device-id") || "anonymous";
    
    if (!scanId) {
      return new Response(JSON.stringify({ error: "scanId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("[scan-result] Fetching scan:", scanId, "device:", deviceId);
    
    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch scan result
    const { data: scan, error: scanError } = await supabase
      .from("scan_results")
      .select("*")
      .eq("id", scanId)
      .single();
    
    if (scanError || !scan) {
      console.log("[scan-result] Scan not found:", scanId);
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Fetch evidence
    const { data: evidenceRows } = await supabase
      .from("scan_evidence")
      .select("*")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: true });
    
    const evidence = (evidenceRows || []).map(row => ({
      id: `${row.provider}-${row.id}`,
      provider: row.provider,
      providerLabel: row.card_title,
      status: row.card_status,
      summary: row.card_payload?.summary ?? '',
      weight: row.card_payload?.weight ?? 25,
      scoreImpact: row.card_payload?.score_impact ?? 0,
      payload: row.card_payload ?? {},
      timestamp: new Date(row.created_at).getTime(),
    }));
    
    const result = {
      id: scan.id,
      url: scan.url,
      finalUrl: scan.final_url,
      domain: scan.domain,
      title: scan.title,
      badge: scan.badge,
      score: scan.score,
      reasons: scan.reasons,
      timestamp: new Date(scan.created_at).getTime(),
      evidence,
      summary: scan.summary,
      scoreBreakdown: scan.score_breakdown,
    };
    
    console.log("[scan-result] Returning scan:", result.id, result.badge);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[scan-result] Error:", error);
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
