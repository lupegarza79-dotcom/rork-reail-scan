// @ts-nocheck
/**
 * Supabase Edge Function: cache-cleanup
 *
 * Ejecuta la función Postgres `cleanup_expired_cache()` para
 * eliminar entradas expiradas de `scan_cache`.
 *
 * GET  => health-check (estado de variables de entorno)
 * POST => ejecuta cleanup_expired_cache()
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ENDPOINT = "cache-cleanup";
const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    `[${ENDPOINT}] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`,
  );
}

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Health-check
  if (req.method === "GET") {
    const secretsOk = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

    const body = {
      ok: secretsOk,
      endpoint: ENDPOINT,
      details: {
        env: {
          supabase_url: !!SUPABASE_URL,
          supabase_service_role_key: !!SUPABASE_SERVICE_ROLE_KEY,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      status: secretsOk ? 200 : 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  // Sólo aceptamos POST para ejecutar la limpieza
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        endpoint: ENDPOINT,
        error_code: "method_not_allowed",
        message: "Method not allowed. Use POST or GET.",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Ejecuta la función Postgres definida por CODEX:
    // CREATE OR REPLACE FUNCTION cleanup_expired_cache()
    const { data, error } = await supabase.rpc("cleanup_expired_cache");

    if (error) {
      console.error(`[${ENDPOINT}] cleanup_expired_cache error:`, error);

      return new Response(
        JSON.stringify({
          ok: false,
          endpoint: ENDPOINT,
          error_code: "cache_cleanup_failed",
          message: "Failed to clean up expired cache entries.",
          details: {
            code: error.code,
            hint: error.hint ?? null,
            message: error.message,
          },
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const deleted =
      typeof data === "number"
        ? data
        : (data as { deleted?: number } | null)?.deleted ?? 0;

    if ( VERBOSE ) {
      console.log(
        `[${ENDPOINT}] cleanup_expired_cache removed ${deleted} rows`,
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        endpoint: ENDPOINT,
        deleted,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err) {
    console.error(`[${ENDPOINT}] unexpected error:`, err);

    return new Response(
      JSON.stringify({
        ok: false,
        endpoint: ENDPOINT,
        error_code: "unexpected_error",
        message: "Unexpected error while cleaning up cache.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});