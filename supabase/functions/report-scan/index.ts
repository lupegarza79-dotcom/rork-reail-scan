// @ts-nocheck
// Supabase Edge Function: report-scan
// POST /report-scan - Submit user reports for scans
// Reports feed into pattern_match + reputation_reports weighting

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const ENDPOINT = "report-scan";
type ReportType = "scam" | "phishing" | "spam" | "misleading" | "safe" | "other";

interface ReportRequest {
  scan_id?: string;
  url: string;
  report_type: ReportType;
  description?: string;
}

async function checkRateLimit(
  supabase: any,
  endpoint: string,
  deviceId: string,
  ip: string,
  limit = 10,
  windowSeconds = 3600,
) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + (windowSeconds * 1000));

  const { data } = await supabase
    .from("rate_limits")
    .select("key, count, window_end")
    .eq("endpoint", endpoint)
    .eq("device_id", deviceId)
    .eq("ip", ip)
    .order("window_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data && new Date(data.window_end) > now) {
    if (data.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((new Date(data.window_end).getTime() - now.getTime()) / 1000),
        remaining: 0,
        limit,
        windowSeconds,
      };
    }

    await supabase
      .from("rate_limits")
      .update({ count: data.count + 1, updated_at: now.toISOString(), limit })
      .eq("key", data.key);

    return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, limit - (data.count + 1)), limit, windowSeconds };
  }

  const key = `${endpoint}:${deviceId}:${ip}:${now.toISOString()}`;
  await supabase.from("rate_limits").upsert({
    key,
    endpoint,
    device_id: deviceId,
    ip,
    count: 1,
    limit,
    window_start: now.toISOString(),
    window_end: windowEnd.toISOString(),
    updated_at: now.toISOString(),
  });

  return { allowed: true, retryAfterSeconds: 0, remaining: Math.max(0, limit - 1), limit, windowSeconds };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.split("/")[0].replace(/^www\./, "");
  }
}

const VERBOSE = Deno.env.get("VERBOSE_LOGGING") === "true";

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
        details: {
          secrets: { PROJECT_URL: !!Deno.env.get("PROJECT_URL"), SERVICE_ROLE_KEY: !!Deno.env.get("SERVICE_ROLE_KEY") },
          verbose: VERBOSE,
        },
        timestamp: new Date().toISOString(),
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
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
    const deviceId = req.headers.get("x-device-id") || "anonymous";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const body: ReportRequest = await req.json();

    if (!body.url || typeof body.url !== "string") {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "URL is required",
        endpoint: ENDPOINT,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validReportTypes: ReportType[] = ["scam", "phishing", "spam", "misleading", "safe", "other"];
    if (!body.report_type || !validReportTypes.includes(body.report_type)) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "invalid_input",
        message: "Valid report_type is required",
        endpoint: ENDPOINT,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[report-scan] New report:", body.url, body.report_type, "device:", deviceId);

    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rateCheck = await checkRateLimit(supabase, ENDPOINT, deviceId, ip, 10, 3600);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "rate_limit_exceeded",
        message: "Rate limit exceeded",
        endpoint: ENDPOINT,
        retry_after_seconds: rateCheck.retryAfterSeconds,
        rate_limit: {
          remaining: rateCheck.remaining,
          limit: rateCheck.limit,
          window_seconds: rateCheck.windowSeconds,
        },
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfterSeconds),
        },
      });
    }

    const domain = extractDomain(body.url);

    const { data: existingReport } = await supabase
      .from("scan_reports")
      .select("id")
      .eq("device_id", deviceId)
      .eq("url", body.url)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .single();

    if (existingReport) {
      return new Response(JSON.stringify({
        ok: false,
        error_code: "rate_limit_exceeded",
        message: "You have already reported this URL in the last 24 hours",
        endpoint: ENDPOINT,
        retry_after_seconds: 86400,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: report, error: reportError } = await supabase
      .from("scan_reports")
      .insert({
        device_id: deviceId,
        scan_id: body.scan_id || null,
        url: body.url,
        domain,
        report_type: body.report_type,
        description: body.description || null,
      })
      .select()
      .single();

    if (reportError) {
      console.error("[report-scan] DB insert error:", JSON.stringify(reportError, null, 2));
      const isTableMissing = reportError.code === "42P01" || (reportError.message?.includes("relation") && reportError.message?.includes("does not exist"));
      return new Response(JSON.stringify({
        ok: false,
        error_code: reportError.code || "db_error",
        message: isTableMissing ? "Table scan_reports does not exist. Apply migration 20240204_scan_reports.sql" : "Failed to insert report",
        endpoint: ENDPOINT,
      }), { status: isTableMissing ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { count: totalReports } = await supabase
      .from("scan_reports")
      .select("*", { count: "exact", head: true })
      .or(`url.eq.${body.url},domain.eq.${domain}`);

    console.log("[report-scan] Report saved:", report.id, "Total:", totalReports);

    return new Response(JSON.stringify({
      ok: true,
      report_id: report.id,
      message: "Report submitted successfully",
      total_reports: totalReports || 1,
      rate_limit: {
        remaining: rateCheck.remaining,
        limit: rateCheck.limit,
        window_seconds: rateCheck.windowSeconds,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[report-scan] Error:", error);
    const errObj = error instanceof Error ? error : new Error(String(error));
    return new Response(JSON.stringify({
      ok: false,
      error_code: (error as any)?.code ?? "internal_error",
      message: errObj.message,
      endpoint: ENDPOINT,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
