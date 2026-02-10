// @ts-nocheck
// Supabase Edge Function: claim
// POST /claim - Submit a profile/domain claim (TrustOps queue)
// GET  /claim?health - Health check

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ENDPOINT = "claim";

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
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
      message: "Use POST to submit a claim",
      endpoint: ENDPOINT,
    }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const deviceId = req.headers.get("x-device-id") || body.device_id || "anonymous";
    const ip = getClientIp(req);

    const domain = (body.domain || body.domain_or_profile || "").trim();
    const contact = (body.contact || body.claimant_email || "").trim();

    if (!domain || domain.length < 3) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "domain is required (min 3 characters)",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!contact || contact.length < 4) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "contact email is required",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const claimRow = {
      domain,
      device_id: deviceId,
      ip,
      contact,
      proof_method: body.proof_method || "documentation",
      evidence_links: Array.isArray(body.evidence_links) ? body.evidence_links : null,
      message: body.message || null,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("claims")
      .insert(claimRow)
      .select("id, status, created_at")
      .single();

    if (error) {
      console.error(`[${ENDPOINT}] Insert error:`, error);
      return new Response(JSON.stringify({
        ok: false,
        error_code: "db_error",
        message: "Failed to submit claim",
        endpoint: ENDPOINT,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[${ENDPOINT}] Claim created:`, data.id, "for domain:", domain);

    return new Response(JSON.stringify({
      ok: true,
      claim_id: data.id,
      status: data.status,
      domain,
      created_at: data.created_at,
      message: "Claim submitted. We review within 5 business days.",
      endpoint: ENDPOINT,
    }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(`[${ENDPOINT}] Error:`, err);
    return new Response(JSON.stringify({
      ok: false,
      error_code: "internal_error",
      message: "Unexpected error processing claim",
      endpoint: ENDPOINT,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
