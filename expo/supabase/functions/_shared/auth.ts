import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { jsonResponse } from "./cors.ts";

export function getServiceRoleKey(): string {
  return Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

export function getProjectUrl(): string {
  return Deno.env.get("PROJECT_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
}

export function getSupabaseAdmin() {
  const url = getProjectUrl();
  const key = getServiceRoleKey();
  if (!url || !key) throw new Error("Missing PROJECT_URL or SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function requireServiceRole(req: Request, endpoint: string): Response | null {
  const authHeader = req.headers.get("authorization");
  const serviceKey = getServiceRoleKey();
  const bearerToken = authHeader?.replace("Bearer ", "") ?? "";
  if (!serviceKey || bearerToken !== serviceKey) {
    return jsonResponse({
      ok: false,
      error_code: "forbidden",
      message: "This endpoint requires service-role authorization",
      endpoint,
    }, 403);
  }
  return null;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || "unknown";
}

export function getDeviceId(req: Request, bodyDeviceId?: string): string {
  return req.headers.get("x-device-id") || bodyDeviceId || "anonymous";
}
