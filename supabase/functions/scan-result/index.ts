// @ts-nocheck
// Supabase Edge Function: scan-result
// GET /scan-result?scanId= - Returns full scan result with normalized evidence
// Returns: BackendScanResult

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ENDPOINT = "scan-result";
const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

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
        secrets: { PROJECT_URL: !!Deno.env.get("PROJECT_URL"), SERVICE_ROLE_KEY: !!Deno.env.get("SERVICE_ROLE_KEY") },
        verbose: VERBOSE,
      },
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({
      ok: false,
      error_code: "method_not_allowed",
      message: "Method not allowed",
      endpoint: ENDPOINT,
    }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const scanId = url.searchParams.get("scanId");
    const deviceId = req.headers.get("x-device-id") || "anonymous";

    if (!scanId) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "scanId is required",
        endpoint: ENDPOINT,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[scan-result] Fetching scan:", scanId, "device:", deviceId);

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: scan, error: scanError } = await supabase
      .from("scan_results")
      .select("*")
      .eq("id", scanId)
      .single();

    if (scanError || !scan) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "not_found",
        message: "Scan not found",
        endpoint: ENDPOINT,
      }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (scan.device_id && scan.device_id !== deviceId && deviceId === "anonymous") {
      console.log("[scan-result] Device ownership check: restricted", deviceId, "!=", scan.device_id);
      return new Response(JSON.stringify({
        ok: false,
        error_code: "forbidden",
        message: "You do not have access to this scan result",
        endpoint: ENDPOINT,
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: evidenceRows } = await supabase
      .from("scan_evidence")
      .select("id, provider, card_title, card_status, card_payload, created_at")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: true });

    const evidence = (evidenceRows || []).map((row) => ({
      id: row.id,
      provider: row.provider,
      providerLabel: row.card_title || row.provider,
      title: row.card_title || row.provider,
      status: row.card_status,
      summary: row.card_payload?.summary ?? "",
      weight: row.card_payload?.weight ?? 0,
      scoreImpact: row.card_payload?.score_impact ?? 0,
      payload: row.card_payload ?? {},
      timestamp: new Date(row.created_at).getTime(),
    }));

    const result = {
      ok: true,
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
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[scan-result] Error:", error);
    const errObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      ok: false,
      error_code: (error as any)?.code ?? "internal_error",
      message: errObj.message,
      endpoint: ENDPOINT,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
