// Supabase Edge Function: scan-evidence
// GET /scan/evidence?scanId= - Returns evidence rows for a scan
// Returns: { evidence: [...] }

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
    
    console.log("[scan-evidence] Fetching evidence for:", scanId, "device:", deviceId);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // First verify the scan belongs to this device
    const { data: scan, error: scanError } = await supabase
      .from("scan_results")
      .select("id, device_id")
      .eq("id", scanId)
      .single();
    
    if (scanError || !scan) {
      console.log("[scan-evidence] Scan not found:", scanId);
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Fetch evidence for this scan
    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("scan_evidence")
      .select("*")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: true });
    
    if (evidenceError) {
      console.error("[scan-evidence] DB error:", evidenceError);
      throw evidenceError;
    }
    
    const evidence = (evidenceRows || []).map(row => ({
      provider: row.provider,
      status: row.status,
      summary: row.summary,
      weight: row.weight,
      payload: row.payload || {},
    }));
    
    console.log("[scan-evidence] Found", evidence.length, "evidence items");
    
    return new Response(JSON.stringify({ evidence }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[scan-evidence] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
