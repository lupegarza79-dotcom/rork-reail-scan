// @ts-nocheck
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

const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

function log(...args: unknown[]) {
  if (VERBOSE) console.log("[scan-evidence][verbose]", ...args);
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
      function: "scan-evidence",
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
    
    console.log("[scan-evidence] Fetching evidence for:", scanId, "device:", deviceId);
    
    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // First verify the scan belongs to this device
    const { data: scan, error: scanError } = await supabase
      .from("scan_results")
      .select("id, device_id")
      .eq("id", scanId)
      .single();
    
    if (scanError || !scan) {
      console.log("[scan-evidence] Scan not found:", scanId);
      return new Response(JSON.stringify({ evidence: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (scan.device_id !== deviceId) {
      console.log("[scan-evidence] Device mismatch:", deviceId, "!=", scan.device_id);
      return new Response(JSON.stringify({ evidence: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("scan_evidence")
      .select("provider, card_title, card_status, card_payload, created_at")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: true });
    
    if (evidenceError) {
      console.error("[scan-evidence] DB error:", evidenceError);
      throw evidenceError;
    }
    
    const evidence = (evidenceRows || []).map(row => ({
      provider: row.provider,
      status: row.card_status,
      summary: row.card_payload?.summary ?? '',
      weight: row.card_payload?.weight ?? 25,
      payload: row.card_payload ?? {},
    }));
    
    console.log("[scan-evidence] Found", evidence.length, "evidence items");
    
    return new Response(JSON.stringify({ evidence }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[scan-evidence] Error:", error);
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
