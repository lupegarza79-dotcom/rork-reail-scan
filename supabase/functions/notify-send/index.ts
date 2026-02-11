// @ts-nocheck
// Supabase Edge Function: notify-send
// POST /notify-send - Send a notification (service-role internal)
// GET  /notify-send?health - Health check

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ENDPOINT = "notify-send";

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
      message: "Use POST to send a notification",
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

    const channel = body.channel || "in_app";
    const recipientType = body.recipient_type || "device";
    const recipient = body.recipient;
    const subject = body.subject || null;
    const notifBody = body.body;

    if (!recipient) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "recipient is required",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!notifBody || typeof notifBody !== "string" || notifBody.trim().length < 1) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "body (notification text) is required",
        endpoint: ENDPOINT,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let status = "sent";
    let errorMessage: string | null = null;
    const sentAt = new Date().toISOString();

    if (channel === "email") {
      console.log(`[${ENDPOINT}] Email delivery not yet configured, marking as pending`);
      status = "pending";
    } else if (channel === "webhook" && body.webhook_url) {
      try {
        const webhookResp = await fetch(body.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, body: notifBody, recipient, metadata: body.metadata }),
          signal: AbortSignal.timeout(5000),
        });
        if (!webhookResp.ok) {
          status = "failed";
          errorMessage = `Webhook returned ${webhookResp.status}`;
        } else {
          status = "delivered";
        }
      } catch (e) {
        status = "failed";
        errorMessage = e instanceof Error ? e.message : String(e);
      }
    }

    const { data: notification, error: insertError } = await supabase
      .from("trustops_notifications")
      .insert({
        channel,
        recipient_type: recipientType,
        recipient,
        subject,
        body: notifBody,
        metadata: body.metadata || {},
        status,
        error_message: errorMessage,
        related_entity_type: body.related_entity_type || null,
        related_entity_id: body.related_entity_id || null,
        sent_at: status === "sent" || status === "delivered" ? sentAt : null,
      })
      .select("id, status, created_at")
      .single();

    if (insertError) {
      console.error(`[${ENDPOINT}] Insert error:`, insertError);
      return new Response(JSON.stringify({
        ok: false,
        error_code: "db_error",
        message: "Failed to record notification",
        endpoint: ENDPOINT,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[${ENDPOINT}] Notification sent:`, notification.id, channel, recipient, status);

    return new Response(JSON.stringify({
      ok: true,
      notification_id: notification.id,
      channel,
      recipient,
      status: notification.status,
      created_at: notification.created_at,
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
