// @ts-nocheck
// Supabase Edge Function: audit-run
// POST /audit-run - Trigger an audit run (service-role only)
// GET  /audit-run?health - Health check

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ENDPOINT = "audit-run";

function getSupabase() {
  const url = Deno.env.get("PROJECT_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("Missing PROJECT_URL or SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("health") !== null) {
      return new Response(JSON.stringify({
        ok: true,
        endpoint: ENDPOINT,
        timestamp: new Date().toISOString(),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      ok: false,
      error_code: "method_not_allowed",
      message: "Use POST to trigger an audit run",
      endpoint: ENDPOINT,
    }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const startTime = Date.now();
  try {
    const supabase = getSupabase();
    const body = await req.json();

    const runType = body.run_type || "automated";
    const triggerType = body.trigger_type || null;
    const triggerId = body.trigger_id || null;
    const domain = body.domain || null;
    const scanId = body.scan_id || null;

    const { data: auditRun, error: insertError } = await supabase
      .from("trustops_audit_runs")
      .insert({
        run_type: runType,
        status: "running",
        trigger_type: triggerType,
        trigger_id: triggerId,
        domain,
        scan_id: scanId,
        input_data: body,
        started_at: new Date().toISOString(),
      })
      .select("id, status, created_at")
      .single();

    if (insertError) {
      console.error(`[${ENDPOINT}] Insert error:`, insertError);
      return new Response(JSON.stringify({
        ok: false,
        error_code: "db_error",
        message: "Failed to create audit run",
        endpoint: ENDPOINT,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const outputData: Record<string, unknown> = {
      checks_performed: [],
      findings: [],
    };

    if (domain) {
      const { data: trustProfile } = await supabase
        .from("domain_trust_profiles")
        .select("*")
        .eq("domain", domain)
        .maybeSingle();

      if (trustProfile) {
        outputData.trust_profile = trustProfile;
        outputData.checks_performed = ["trust_profile_lookup"];
      }
    }

    if (scanId) {
      const { data: scanResult } = await supabase
        .from("scan_results")
        .select("id, badge, score, domain, summary")
        .eq("id", scanId)
        .maybeSingle();

      if (scanResult) {
        outputData.scan_result = scanResult;
        (outputData.checks_performed as string[]).push("scan_result_lookup");
      }
    }

    await supabase
      .from("trustops_audit_runs")
      .update({
        status: "completed",
        output_data: outputData,
        completed_at: new Date().toISOString(),
      })
      .eq("id", auditRun.id);

    console.log(`[${ENDPOINT}] Audit run completed:`, auditRun.id, `${Date.now() - startTime}ms`);

    return new Response(JSON.stringify({
      ok: true,
      audit_run_id: auditRun.id,
      status: "completed",
      output: outputData,
      latency_ms: Date.now() - startTime,
      endpoint: ENDPOINT,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(`[${ENDPOINT}] Error:`, err);
    return new Response(JSON.stringify({
      ok: false,
      error_code: "internal_error",
      message: err instanceof Error ? err.message : "Unexpected error",
      endpoint: ENDPOINT,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
