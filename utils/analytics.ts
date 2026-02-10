import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceId } from './deviceId';
import { BASE_URL, headers } from './api';

export type AnalyticsEvent =
  | 'scan_started'
  | 'quick_scan_success'
  | 'content_scan_success'
  | 'fallback_used'
  | 'share_created'
  | 'money_case_started'
  | 'appeal_submitted'
  | 'claim_submitted'
  | 'scan_result_viewed'
  | 'evidence_expanded'
  | 'trust_graph_viewed';

interface EventPayload {
  event: AnalyticsEvent;
  timestamp: number;
  device_id?: string;
  meta?: Record<string, string | number | boolean>;
}

const BUFFER_KEY = 'reail_analytics_buffer';
const FLUSH_THRESHOLD = 20;
const FLUSH_INTERVAL = 60_000;

let buffer: EventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export async function trackEvent(
  event: AnalyticsEvent,
  meta?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    const payload: EventPayload = {
      event,
      timestamp: Date.now(),
      device_id: deviceId,
      meta,
    };

    console.log(`[Analytics] ${event}`, meta ?? '');
    buffer.push(payload);

    if (buffer.length >= FLUSH_THRESHOLD) {
      await flushEvents();
    } else if (!flushTimer) {
      flushTimer = setTimeout(() => flushEvents(), FLUSH_INTERVAL);
    }
  } catch (err) {
    console.log('[Analytics] Track error:', err);
  }
}

async function flushEvents(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (buffer.length === 0) return;

  const toFlush = [...buffer];
  buffer = [];

  try {
    const existing = await AsyncStorage.getItem(BUFFER_KEY);
    const stored: EventPayload[] = existing ? JSON.parse(existing) : [];
    const combined = [...stored, ...toFlush].slice(-200);
    await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(combined));

    const h = await headers();
    fetch(`${BASE_URL}/telemetry`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ events: toFlush }),
    }).catch(() => {});
  } catch {
    buffer = [...toFlush, ...buffer];
  }
}

export async function getLocalAnalytics(): Promise<EventPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
