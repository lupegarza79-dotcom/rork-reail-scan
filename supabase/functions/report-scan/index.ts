// @ts-nocheck
// Supabase Edge Function: report-scan
// POST /report-scan - Submit user reports for scans
// Reports feed into pattern_match weighting

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-device-id, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ReportType = "scam" | "phishing" | "spam" | "misleading" | "safe" | "other";

interface ReportRequest {
  scan_id?: string;
  url: string;
  report_type: ReportType;
  description?: string;
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.split("/")[0].replace(/^www\./, "");
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  try {
    const deviceId = req.headers.get("x-device-id") || "anonymous";
    const body: ReportRequest = await req.json();
    
    if (!body.url || typeof body.url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const validReportTypes: ReportType[] = ["scam", "phishing", "spam", "misleading", "safe", "other"];
    if (!body.report_type || !validReportTypes.includes(body.report_type)) {
      return new Response(JSON.stringify({ error: "Valid report_type is required (scam, phishing, spam, misleading, safe, other)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("[report-scan] New report:", body.url, body.report_type, "device:", deviceId);
    
    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const domain = extractDomain(body.url);
    
    const { data: existingReport } = await supabase
      .from("scan_reports")
      .select("id")
      .eq("device_id", deviceId)
      .eq("url", body.url)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single();
    
    if (existingReport) {
      return new Response(JSON.stringify({ 
        error: "You have already reported this URL in the last 24 hours",
        report_id: existingReport.id,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      const isTableMissing = reportError.code === '42P01' || reportError.message?.includes('relation') && reportError.message?.includes('does not exist');
      return new Response(JSON.stringify({
        error: isTableMissing ? "Table scan_reports does not exist. Please apply migration 20240204_scan_reports.sql" : "Failed to insert report",
        db_error: reportError.message,
        db_code: reportError.code,
        db_details: reportError.details,
        db_hint: reportError.hint,
      }), {
        status: isTableMissing ? 503 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const { count: totalReports } = await supabase
      .from("scan_reports")
      .select("*", { count: "exact", head: true })
      .or(`url.eq.${body.url},domain.eq.${domain}`);
    
    console.log("[report-scan] Report saved:", report.id, "Total reports for URL/domain:", totalReports);
    
    return new Response(JSON.stringify({
      report_id: report.id,
      message: "Report submitted successfully",
      total_reports: totalReports || 1,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[report-scan] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
