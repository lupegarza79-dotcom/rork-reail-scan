import { jsonResponse } from "./cors.ts";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  windowSeconds: number;
}

export async function checkRateLimit(
  supabase: any,
  endpoint: string,
  deviceId: string,
  ip: string,
  limit: number,
  windowMinutes: number,
): Promise<RateLimitResult> {
  const now = new Date();
  const windowSeconds = windowMinutes * 60;
  const windowEnd = new Date(now.getTime() + windowSeconds * 1000);

  try {
    const { data, error } = await supabase
      .from("rate_limits")
      .select("key, count, window_end, blocked_until")
      .eq("endpoint", endpoint)
      .eq("device_id", deviceId)
      .eq("ip", ip)
      .order("window_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log("[RateLimit] Lookup error (fail-open):", error.message);
      return { allowed: true, retryAfterSeconds: 0, remaining: limit, limit, windowSeconds };
    }

    if (data?.blocked_until && new Date(data.blocked_until) > now) {
      const retryAfterSeconds = Math.ceil((new Date(data.blocked_until).getTime() - now.getTime()) / 1000);
      return { allowed: false, retryAfterSeconds, remaining: 0, limit, windowSeconds };
    }

    if (data && new Date(data.window_end) > now) {
      if (data.count >= limit) {
        await supabase
          .from("rate_limits")
          .update({ blocked_until: data.window_end, updated_at: now.toISOString() })
          .eq("key", data.key);
        const retryAfterSeconds = Math.ceil((new Date(data.window_end).getTime() - now.getTime()) / 1000);
        return { allowed: false, retryAfterSeconds, remaining: 0, limit, windowSeconds };
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
  } catch (err) {
    console.log("[RateLimit] Unexpected error (fail-open):", err);
    return { allowed: true, retryAfterSeconds: 0, remaining: limit, limit, windowSeconds };
  }
}

export function rateLimitResponse(endpoint: string, result: RateLimitResult): Response {
  return jsonResponse({
    ok: false,
    error_code: "rate_limit_exceeded",
    message: "Rate limit exceeded",
    endpoint,
    retry_after_seconds: result.retryAfterSeconds,
    rate_limit: {
      remaining: result.remaining,
      limit: result.limit,
      window_seconds: result.windowSeconds,
    },
  }, 429, { "Retry-After": String(result.retryAfterSeconds) });
}
