export interface TelemetryEvent {
  trace_id?: string;
  endpoint: string;
  event_type: string;
  provider?: string;
  device_id?: string;
  ip?: string;
  scan_id?: string;
  status?: string;
  latency_ms?: number;
  cache_hit?: boolean | null;
  error_code?: string;
  success?: boolean;
  score?: number;
  badge?: string;
  metadata?: Record<string, unknown>;
}

export function generateTraceId(): string {
  return crypto.randomUUID();
}

export async function logTelemetry(
  supabase: any,
  payload: TelemetryEvent | TelemetryEvent[],
): Promise<void> {
  try {
    const records = Array.isArray(payload) ? payload : [payload];
    if (records.length === 0) return;
    const enriched = records.map((r) => ({
      ...r,
      trace_id: r.trace_id || generateTraceId(),
      created_at: new Date().toISOString(),
    }));
    await supabase.from("scan_telemetry_events").insert(enriched);
  } catch (error) {
    console.log("[Telemetry] Best-effort write failed:", error);
  }
}
