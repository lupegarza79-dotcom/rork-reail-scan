// @ts-nocheck
// Supabase Edge Function: wallet-share
// POST /wallet-share - Create an evidence-backed shareable link
// GET /wallet-share?token=<token> - Resolve a share link
// Returns evidence-guaranteed: badge, score, top_red_flags, next_action never null.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsHeaders, corsResponse, jsonResponse } from "../_shared/cors.ts";
import { getClientIp, getDeviceId, getProjectUrl, getServiceRoleKey } from "../_shared/auth.ts";
import { getOrRunScan, normalizeUrl, extractDomain } from "../_shared/scan-core.ts";

const ENDPOINT = "wallet-share";
const WALLET_SHARE_TTL_DAYS = parseInt(Deno.env.get("WALLET_SHARE_TTL_DAYS") || "8", 10);
const DEFAULT_EXPIRY_HOURS = WALLET_SHARE_TTL_DAYS * 24;
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  const reqUrl = new URL(req.url);

  if (reqUrl.searchParams.get("health") !== null) {
    return jsonResponse({
      ok: true,
      endpoint: ENDPOINT,
      details: {
        secrets: {
          PROJECT_URL: !!getProjectUrl(),
          SERVICE_ROLE_KEY: !!getServiceRoleKey(),
          GOOGLE_WEBRISK_API_KEY: !!Deno.env.get("GOOGLE_WEBRISK_API_KEY"),
        },
        verbose: VERBOSE,
      },
      timestamp: new Date().toISOString(),
    });
  }

  const supabaseUrl = getProjectUrl();
  const supabaseServiceKey = getServiceRoleKey();
  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const deviceId = getDeviceId(req);
  const ip = getClientIp(req);

  try {
    if (req.method === "GET") {
      const token = reqUrl.searchParams.get("token");
      if (!token) {
        return jsonResponse({
          ok: false,
          error_code: "invalid_input",
          message: "token query parameter is required",
          endpoint: ENDPOINT,
        }, 400);
      }

      const { data: shareLink, error } = await supabase
        .from("wallet_share_links")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (error || !shareLink) {
        return jsonResponse({
          ok: false,
          error_code: "not_found",
          message: "Share link not found",
          endpoint: ENDPOINT,
        }, 404);
      }

      if (new Date(shareLink.expires_at) < new Date()) {
        return jsonResponse({
          ok: false,
          error_code: "expired",
          message: "This share link has expired",
          endpoint: ENDPOINT,
        }, 410);
      }

      await supabase.rpc("increment_share_view", { p_token: token });

      let evidence: unknown[] = [];
      if (shareLink.normalized_url) {
        const { data: cached } = await supabase
          .from("scan_cache")
          .select("value")
          .eq("key", `scan:${shareLink.normalized_url}`)
          .maybeSingle();
        if (cached?.value && Array.isArray(cached.value.evidence)) {
          evidence = cached.value.evidence;
        }
      }
      if (evidence.length === 0 && shareLink.scan_id) {
        const { data: evRows } = await supabase
          .from("scan_evidence")
          .select("provider, provider_label, status, summary, weight, score_impact, payload, card_title, card_status, card_payload")
          .eq("scan_id", shareLink.scan_id);
        if (Array.isArray(evRows)) evidence = evRows;
      }

      return jsonResponse({
        ok: true,
        token: shareLink.token,
        original_url: shareLink.original_url,
        normalized_url: shareLink.normalized_url,
        domain: shareLink.domain,
        badge: shareLink.badge,
        score: shareLink.score,
        top_red_flags: shareLink.top_red_flags || [],
        next_action: shareLink.next_action,
        scan_id: shareLink.scan_id,
        evidence,
        created_at: shareLink.created_at,
        expires_at: shareLink.expires_at,
        view_count: (shareLink.view_count || 0) + 1,
        needs_full_scan: false,
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const targetUrl: string | undefined = body?.url;
      const expiryHours = body?.expiry_hours || DEFAULT_EXPIRY_HOURS;

      if (!targetUrl) {
        return jsonResponse({
          ok: false,
          error_code: "invalid_input",
          message: "url is required in request body",
          endpoint: ENDPOINT,
        }, 400);
      }

      const normalized = normalizeUrl(targetUrl);
      const domain = extractDomain(normalized);

      if (VERBOSE) console.log("[wallet-share] POST normalize:", { input: targetUrl, normalized, domain });

      const scan = await getOrRunScan(targetUrl, supabase, deviceId);

      const badge = scan.badge;
      const score = scan.score;
      const topRedFlags = Array.isArray(scan.top_red_flags) ? scan.top_red_flags : [];
      const nextAction = scan.next_action;
      const scanId = (scan as { scan_id?: string }).scan_id ?? crypto.randomUUID();
      const evidence = Array.isArray(scan.evidence) ? scan.evidence : [];

      const token = generateToken(TOKEN_LENGTH);
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      const { error: insertError } = await supabase
        .from("wallet_share_links")
        .insert({
          token,
          original_url: targetUrl,
          normalized_url: normalized,
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
        return jsonResponse({
          ok: false,
          error_code: "db_error",
          message: "Failed to create share link",
          endpoint: ENDPOINT,
        }, 500);
      }

      const shareUrl = `/s/${token}`;

      return jsonResponse({
        ok: true,
        token,
        share_url: shareUrl,
        original_url: targetUrl,
        normalized_url: normalized,
        domain,
        badge,
        score,
        top_red_flags: topRedFlags,
        next_action: nextAction,
        evidence,
        expires_at: expiresAt.toISOString(),
        scan_id: scanId,
        cache_hit: scan.cache_hit,
        needs_full_scan: false,
      }, 201);
    }

    return jsonResponse({
      ok: false,
      error_code: "method_not_allowed",
      message: "Method not allowed",
      endpoint: ENDPOINT,
    }, 405);
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
