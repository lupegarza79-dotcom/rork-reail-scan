// @ts-nocheck
// Supabase Edge Function: outcome-update
// POST /outcome-update - Record a TrustOps outcome (service-role internal)
// GET  /outcome-update?health - Health check

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ENDPOINT = "outcome-update";

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
      message: "Use POST to record an outcome",
      endpoint: ENDPOINT,
    }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const supabase = getSupabase();
    const body = await req.json();

    const entityType = body.entity_type;
    const entityId = body.entity_id;
    const action = body.action;

    if (!entityType || !["appeal", "claim", "scan", "domain"].includes(entityType)) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "entity_type must be one of: appeal, claim, scan, domain",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!entityId) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "entity_id is required",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!action || !["accepted", "rejected", "escalated", "badge_updated", "tier_updated", "no_action"].includes(action)) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "action must be one of: accepted, rejected, escalated, badge_updated, tier_updated, no_action",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: outcome, error: insertError } = await supabase
      .from("trustops_outcomes")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        action,
        previous_value: body.previous_value || {},
        new_value: body.new_value || {},
        reason: body.reason || null,
        resolved_by: body.resolved_by || "system",
        audit_run_id: body.audit_run_id || null,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      console.error(`[${ENDPOINT}] Insert error:`, insertError);
      return new Response(JSON.stringify({
        ok: false,
        error_code: "db_error",
        message: "Failed to record outcome",
        endpoint: ENDPOINT,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[${ENDPOINT}] Outcome recorded:`, outcome.id, entityType, entityId, action);

    return new Response(JSON.stringify({
      ok: true,
      outcome_id: outcome.id,
      entity_type: entityType,
      entity_id: entityId,
      action,
      created_at: outcome.created_at,
      endpoint: ENDPOINT,
    }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
