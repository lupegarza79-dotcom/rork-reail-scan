// supabase/functions/quick-scan/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { webRiskLookup } from "../_shared/webrisk.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const requestUrl = new URL(req.url);

let url: string | null = null;

if (req.method === "GET") {
  url = requestUrl.searchParams.get("url");
} else {
  const body = await req.json().catch(() => ({}));
  url = typeof body?.url === "string" ? body.url : null;
}

if (!url) {
  return new Response(JSON.stringify({ error: "Missing 'url'" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

    const webrisk = await webRiskLookup(url);

    const verdict =
      webrisk.threatTypes.length === 0 ? "clear" :
      webrisk.threatTypes.includes("MALWARE") ? "danger" :
      webrisk.threatTypes.includes("SOCIAL_ENGINEERING") ? "danger" :
      "warning";

    return new Response(JSON.stringify({
      url,
      providers: {
        google_webrisk: {
          threatTypes: webrisk.threatTypes,
          verdict,
        },
      },
      // esto lo dejamos simple y determinístico por ahora
      trust: {
        score: verdict === "clear" ? 0.90 : verdict === "warning" ? 0.30 : 0.00,
        reason: "google webrisk lookup",
      },
      ts: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
