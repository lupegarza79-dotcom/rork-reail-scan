// @ts-nocheck
// Supabase Edge Function: appeal
// POST /appeal - Submit an appeal for a scan result (TrustOps queue)
// GET  /appeal?health - Health check

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ENDPOINT = "appeal";

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
      message: "Use POST to submit an appeal",
      endpoint: ENDPOINT,
    }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const deviceId = req.headers.get("x-device-id") || body.device_id || "anonymous";
    const ip = getClientIp(req);

    const message = (body.message || body.reason || "").trim();
    if (!message || message.length < 5) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "A message/reason with at least 5 characters is required",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const appealRow = {
      scan_id: body.scan_id || null,
      token: body.token || null,
      device_id: deviceId,
      ip,
      reason: body.reason_type || "incorrect_classification",
      message,
      contact: body.contact || body.email_or_phone_optional || null,
      evidence_links: Array.isArray(body.evidence_links) ? body.evidence_links : null,
      status: "pending",
    };

    const { data, error } = await supabase
      .from("appeals")
      .insert(appealRow)
      .select("id, status, created_at")
      .single();

    if (error) {
      console.error(`[${ENDPOINT}] Insert error:`, error);
      return new Response(JSON.stringify({
        ok: false,
        error_code: "db_error",
        message: "Failed to submit appeal",
        endpoint: ENDPOINT,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[${ENDPOINT}] Appeal created:`, data.id);

    return new Response(JSON.stringify({
      ok: true,
      appeal_id: data.id,
      status: data.status,
      created_at: data.created_at,
      message: "Appeal submitted. We will review within 72 hours.",
      endpoint: ENDPOINT,
    }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error(`[${ENDPOINT}] Error:`, err);
    return new Response(JSON.stringify({
      ok: false,
      error_code: "internal_error",
      message: "Unexpected error processing appeal",
      endpoint: ENDPOINT,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
