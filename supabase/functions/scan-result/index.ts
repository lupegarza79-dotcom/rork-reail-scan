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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
      providerLabel: row.provider_label,
      status: row.status,
      summary: row.summary,
      weight: row.weight,
      scoreImpact: row.score_impact,
      payload: row.payload || {},
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
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
