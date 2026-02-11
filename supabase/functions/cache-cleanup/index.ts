// @ts-nocheck
// Supabase Edge Function: cache-cleanup
// POST /cache-cleanup - Runs cleanup_expired_cache() and returns deleted count

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ENDPOINT = "cache-cleanup";
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
        secrets: {
          PROJECT_URL: !!Deno.env.get("PROJECT_URL"),
          SERVICE_ROLE_KEY: !!Deno.env.get("SERVICE_ROLE_KEY"),
        },
        verbose: VERBOSE,
      },
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") {
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
    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc("cleanup_expired_cache");
    if (error) {
      console.error("[cache-cleanup] RPC error:", error);
      throw error;
    }

    const deleted = typeof data === "number" ? data : Number(data || 0);
    return new Response(JSON.stringify({ ok: true, deleted }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cache-cleanup] Error:", error);
    const errObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      ok: false,
      error_code: (error as any)?.code ?? "internal_error",
      message: errObj.message,
      endpoint: ENDPOINT,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
