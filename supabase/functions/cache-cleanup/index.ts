import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-device-id, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  if (url.searchParams.has("health")) {
    const projectUrl = Deno.env.get("PROJECT_URL");
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");
    return new Response(
      JSON.stringify({
        status: "ok",
        function: "cache-cleanup",
        secrets: {
          PROJECT_URL: !!projectUrl,
          SERVICE_ROLE_KEY: !!serviceKey,
        },
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const projectUrl = Deno.env.get("PROJECT_URL");
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!projectUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ message: "Missing PROJECT_URL or SERVICE_ROLE_KEY", code: "CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(projectUrl, serviceKey);

    const { data, error } = await supabase.rpc("cleanup_expired_cache");

    if (error) {
      console.error("cleanup_expired_cache RPC error:", JSON.stringify(error));
      return new Response(
        JSON.stringify({
          message: "Cache cleanup failed",
          code: error.code,
          details: error.message,
          hint: error.hint ?? null,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deleted = typeof data === "number" ? data : 0;
    console.log(`cache-cleanup: removed ${deleted} expired rows`);

    return new Response(
      JSON.stringify({ status: "ok", deleted, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("cache-cleanup unexpected error:", err);
    return new Response(
      JSON.stringify({ message: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
