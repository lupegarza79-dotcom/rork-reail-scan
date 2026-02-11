// @ts-nocheck
// Supabase Edge Function: trustops-verify-claim
// POST /trustops-verify-claim - Verify/resolve a claim (service-role internal)
// GET  /trustops-verify-claim?health - Health check

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ENDPOINT = "trustops-verify-claim";

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
      message: "Use POST to verify a claim",
      endpoint: ENDPOINT,
    }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("authorization");
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearerToken = authHeader?.replace("Bearer ", "") ?? "";
  if (!serviceKey || bearerToken !== serviceKey) {
    return new Response(JSON.stringify({
      ok: false,
      error_code: "forbidden",
      message: "This endpoint requires service-role authorization",
      endpoint: ENDPOINT,
    }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const supabase = getSupabase();
    const body = await req.json();

    const claimId = body.claim_id;
    const action = body.action;
    const reason = body.reason || null;
    const resolvedBy = body.resolved_by || "system";

    if (!claimId) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "claim_id is required",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!action || !["verified", "rejected", "closed"].includes(action)) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "action must be one of: verified, rejected, closed",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: claim, error: fetchError } = await supabase
      .from("claims")
      .select("*")
      .eq("id", claimId)
      .single();

    if (fetchError || !claim) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "not_found",
        message: "Claim not found",
        endpoint: ENDPOINT,
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const previousStatus = claim.status;

    const { error: updateError } = await supabase
      .from("claims")
      .update({
        status: action,
        reviewer_notes: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId);

    if (updateError) {
      console.error(`[${ENDPOINT}] Update error:`, updateError);
      return new Response(JSON.stringify({
        ok: false,
        error_code: "db_error",
        message: "Failed to update claim",
        endpoint: ENDPOINT,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "verified" && claim.domain) {
      await supabase
        .from("domain_trust_profiles")
        .update({ tier_locked: true, trust_tier: "trusted", updated_at: new Date().toISOString() })
        .eq("domain", claim.domain);
      console.log(`[${ENDPOINT}] Domain tier locked to trusted:`, claim.domain);
    }

    const { data: outcome } = await supabase
      .from("trustops_outcomes")
      .insert({
        entity_type: "claim",
        entity_id: claimId,
        action,
        previous_value: { status: previousStatus },
        new_value: { status: action },
        reason,
        resolved_by: resolvedBy,
      })
      .select("id")
      .single();

    console.log(`[${ENDPOINT}] Claim resolved:`, claimId, action);

    return new Response(JSON.stringify({
      ok: true,
      claim_id: claimId,
      domain: claim.domain,
      action,
      previous_status: previousStatus,
      outcome_id: outcome?.id || null,
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
