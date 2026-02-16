// @ts-nocheck
// Supabase Edge Function: wallet-share
// POST /wallet-share - Create a shareable link with scan verdict
// GET /wallet-share?token=<token> - Resolve a share link
// Returns: { ok, share_url, token, badge, score, top_red_flags, next_action }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ENDPOINT = "wallet-share";
const WALLET_SHARE_TTL_DAYS = parseInt(Deno.env.get("WALLET_SHARE_TTL_DAYS") || "8", 10);
const DEFAULT_EXPIRY_HOURS = WALLET_SHARE_TTL_DAYS * 24; // 8 days = 192 hours
const TOKEN_LENGTH = 12;
const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

function generateToken(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.split("/")[0].replace(/^www\./, "");
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}

function computeNextAction(badge: string | null, score: number | null, redFlags: string[]): string {
  if (!badge || score === null) {
    return "Run a full scan to verify this link before clicking.";
  }
  
  if (badge === "HIGH_RISK" || score < 40) {
    return "Do NOT click this link. It shows signs of a scam or phishing attempt.";
  }
  
  if (badge === "UNVERIFIED" || score < 70) {
    if (redFlags.length > 0) {
      return "Proceed with caution. Verify the sender and avoid entering personal info.";
    }
    return "This link couldn't be fully verified. Double-check the source before proceeding.";
  }
  
  return "This link appears safe, but always verify unexpected requests for personal info.";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);

  if (reqUrl.searchParams.get("health") !== null) {
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

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const deviceId = req.headers.get("x-device-id") || "anonymous";
  const ip = getClientIp(req);

  try {
    if (req.method === "GET") {
      const token = reqUrl.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "invalid_input",
          message: "token query parameter is required",
          endpoint: ENDPOINT,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: shareLink, error } = await supabase
        .from("wallet_share_links")
        .select("*")
        .eq("token", token)
        .single();

      if (error || !shareLink) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "not_found",
          message: "Share link not found or expired",
          endpoint: ENDPOINT,
        }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (new Date(shareLink.expires_at) < new Date()) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "expired",
          message: "This share link has expired",
          endpoint: ENDPOINT,
        }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.rpc("increment_share_view", { p_token: token });

      return new Response(JSON.stringify({
        ok: true,
        token: shareLink.token,
        original_url: shareLink.original_url,
        domain: shareLink.domain,
        badge: shareLink.badge,
        score: shareLink.score,
        top_red_flags: shareLink.top_red_flags || [],
        next_action: shareLink.next_action,
        scan_id: shareLink.scan_id,
        created_at: shareLink.created_at,
        expires_at: shareLink.expires_at,
        view_count: (shareLink.view_count || 0) + 1,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const targetUrl = body.url;
      const expiryHours = body.expiry_hours || DEFAULT_EXPIRY_HOURS;

      if (!targetUrl) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: "invalid_input",
          message: "url is required in request body",
          endpoint: ENDPOINT,
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const domain = extractDomain(targetUrl);
      let badge: string | null = null;
      let score: number | null = null;
      let topRedFlags: string[] = [];
      let scanId: string | null = null;

      const cacheKey = `scan:${targetUrl}`;
      const { data: cached } = await supabase
        .from("scan_cache")
        .select("value, expires_at")
        .eq("key", cacheKey)
        .single();

      if (cached && new Date(cached.expires_at) > new Date()) {
        const v = cached.value;
        badge = v.badge;
        score = v.score;
        topRedFlags = (v.evidence || [])
          .filter((e: unknown) => (e as { status: string }).status === "fail" || (e as { status: string }).status === "warn")
          .slice(0, 3)
          .map((e: unknown) => (e as { summary: string }).summary);
        if (VERBOSE) console.log("[wallet-share] Cache HIT for:", targetUrl);
      } else {
        const { data: recentScan } = await supabase
          .from("scan_results")
          .select("id, badge, score, domain")
          .eq("domain", domain)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (recentScan) {
          badge = recentScan.badge;
          score = recentScan.score;
          scanId = recentScan.id;

          const { data: evidenceRows } = await supabase
            .from("scan_evidence")
            .select("card_status, card_payload")
            .eq("scan_id", recentScan.id);

          topRedFlags = (evidenceRows || [])
            .filter((r: unknown) => {
              const row = r as { card_status: string };
              return row.card_status === "fail" || row.card_status === "warn";
            })
            .slice(0, 3)
            .map((r: unknown) => {
              const row = r as { card_payload?: { summary?: string } };
              return row.card_payload?.summary || "Flag detected";
            });

          if (VERBOSE) console.log("[wallet-share] DB HIT for:", targetUrl);
        }
      }

      const nextAction = computeNextAction(badge, score, topRedFlags);
      const token = generateToken(TOKEN_LENGTH);
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      const { error: insertError } = await supabase
        .from("wallet_share_links")
        .insert({
          token,
          original_url: targetUrl,
          domain,
          scan_id: scanId,
          badge,
          score,
          top_red_flags: topRedFlags,
          next_action: nextAction,
          expires_at: expiresAt.toISOString(),
          device_id: deviceId,
          ip,
        });

      if (insertError) {
        console.error("[wallet-share] Insert error:", insertError);
        return new Response(JSON.stringify({
          ok: false,
          error_code: "db_error",
          message: "Failed to create share link",
          endpoint: ENDPOINT,
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const shareUrl = `/s/${token}`;

      return new Response(JSON.stringify({
        ok: true,
        token,
        share_url: shareUrl,
        original_url: targetUrl,
        domain,
        badge,
        score,
        top_red_flags: topRedFlags,
        next_action: nextAction,
        expires_at: expiresAt.toISOString(),
        needs_full_scan: badge === null,
      }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: false,
      error_code: "method_not_allowed",
      message: "Method not allowed",
      endpoint: ENDPOINT,
    }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[wallet-share] Error:", error);
    const errObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      ok: false,
      error_code: "internal_error",
      message: errObj.message,
      endpoint: ENDPOINT,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
