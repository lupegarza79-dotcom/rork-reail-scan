# Supabase Edge Function Routes

## Base URL Configuration

Client `.env`:
```
EXPO_PUBLIC_API_URL=https://<REF>.supabase.co/functions/v1
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...  # Legacy anon public JWT
```

## Required Headers (ALL requests)

```
Authorization: Bearer <LEGACY_ANON_JWT>
apikey: <LEGACY_ANON_JWT>
X-Device-Id: <device-uuid>
Content-Type: application/json
```

> **IMPORTANT:** Use the **Legacy anon (public) JWT** (starts with `eyJhbGci...`) for
> both `Authorization` and `apikey` headers. The newer publishable key
> (`sb_publishable_...`) is **NOT** a JWT and will be rejected by `verify_jwt`.
> Find it in Supabase Dashboard → Settings → API → Project API keys → anon / public.

## Supabase Function Secrets (server-only, set via CLI)

```bash
supabase secrets set PROJECT_URL=https://<REF>.supabase.co
supabase secrets set SERVICE_ROLE_KEY=<service_role_key>
supabase secrets set WHOIS_API_KEY=<whois_api_key>
supabase secrets set CACHE_TTL_HOURS=24
supabase secrets set GOOGLE_SAFE_BROWSING_API_KEY=<key>
supabase secrets set VIRUSTOTAL_API_KEY=<key>
supabase secrets set VERBOSE_LOGGING=true
```

> **Do NOT use `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`** — Supabase rejects
> secret names prefixed with `SUPABASE_`.

| Secret | Required | Description |
|--------|----------|-------------|
| `PROJECT_URL` | ✅ | Supabase project URL |
| `SERVICE_ROLE_KEY` | ✅ | Service role key for DB writes |
| `WHOIS_API_KEY` | Optional | WhoisXML API key for domain age |
| `CACHE_TTL_HOURS` | Optional | Cache TTL in hours (default: 24) |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Optional | Google Safe Browsing v4 key |
| `VIRUSTOTAL_API_KEY` | Optional | VirusTotal API key |
| `VERBOSE_LOGGING` | Optional | Set `"true"` for detailed logs |

## Route Mapping

| Edge Function | Method | Description |
|---------------|--------|-------------|
| `content-scan` | POST | Full scan: link intel + domain intel + pattern match + threat intel + reputation |
| `content-scan` | GET `?health` | Health check |
| `scan-evidence` | GET `?scanId=` | Fetch normalized evidence cards for a scan |
| `scan-result` | GET `?scanId=` | Fetch full scan result with evidence |
| `scan-history` | GET `?limit=&offset=` | Fetch scan history by device_id |
| `report-scan` | POST | Submit user report for a URL |
| `quick-scan` | GET `?url=` | Fast cached lookup for browser extensions |
| `cache-cleanup` | POST | Cleanup expired cache entries |
| `cache-cleanup` | GET `?health` | Health check |

## Deployment

```bash
supabase functions deploy content-scan
supabase functions deploy scan-evidence
supabase functions deploy scan-result
supabase functions deploy scan-history
supabase functions deploy report-scan
supabase functions deploy quick-scan
supabase functions deploy cache-cleanup
```

## Production Scheduler (Cache Cleanup)

Use pg_cron (recommended) or a scheduled Edge Function to run:
```sql
select cleanup_expired_cache();
```

Example pg_cron schedule (every 2 hours):
```sql
select
  cron.schedule(
    'cache-cleanup-2h',
    '0 */2 * * *',
    $$select cleanup_expired_cache();$$
  );
```

Supabase Edge Scheduler alternative (every 2 hours):
```
supabase functions deploy cache-cleanup
supabase functions schedule cache-cleanup --cron "0 */2 * * *"
```

## Health Checks

Every function exposes `GET ?health`:
```json
{
  "ok": true,
  "endpoint": "<name>",
  "details": { "secrets": { "PROJECT_URL": true, "SERVICE_ROLE_KEY": true } },
  "timestamp": "2024-02-03T12:00:00.000Z"
}
```

content-scan health also reports: `GOOGLE_SAFE_BROWSING_API_KEY`, `VIRUSTOTAL_API_KEY`, `CACHE_TTL_HOURS`.

## Rate Limiting

`content-scan` and `quick-scan` enforce basic rate limits based on `X-Device-Id` + IP.
Each successful response includes a `rate_limit` object:
```json
{
  "ok": true,
  "rate_limit": {
    "remaining": 29,
    "limit": 30,
    "window_seconds": 3600
  }
}
```

When exceeded, responses return `429` with a `Retry-After` header and:
```json
{
  "ok": false,
  "error_code": "rate_limit_exceeded",
  "message": "Rate limit exceeded",
  "endpoint": "content-scan",
  "retry_after_seconds": 3600,
  "rate_limit": { "remaining": 0, "limit": 30, "window_seconds": 3600 },
  "trace_id": "optional"
}
```

## Standardized Error Format

All functions return errors as:
```json
{
  "ok": false,
  "error_code": "string_machine_readable",
  "message": "Human readable",
  "endpoint": "content-scan",
  "trace_id": "optional"
}
```

## Response Types

### POST /content-scan
Request:
```json
{ "url": "https://example.com" }
```
Response:
```json
{
  "ok": true,
  "scan_id": "uuid",
  "badge": "VERIFIED" | "UNVERIFIED" | "HIGH_RISK",
  "score": 85,
  "summary": "string",
  "cache_hit": false,
  "evidence": [
    {
      "provider": "link_intel" | "domain_intel" | "pattern_match" | "google_safe_browsing" | "virustotal" | "reputation_reports",
      "status": "pass" | "warn" | "fail" | "unknown",
      "summary": "string",
      "weight": 25,
      "payload": { ... }
    }
  ],
  "score_breakdown": {
    "baseScore": 70,
    "adjustments": [...],
    "finalScore": 85,
    "badge": "VERIFIED"
  }
}
```

### GET /scan-evidence?scanId=uuid
Response (normalized):
```json
{
  "ok": true,
  "evidence": [
    {
      "id": "uuid",
      "provider": "link_intel",
      "providerLabel": "Link Intel",
      "title": "Link Intel",
      "status": "pass",
      "summary": "URL passed link analysis",
      "weight": 25,
      "scoreImpact": 5,
      "payload": { ... },
      "timestamp": 1706961600000
    }
  ]
}
```

### GET /scan-result?scanId=uuid
Response:
```json
{
  "ok": true,
  "id": "uuid",
  "url": "string",
  "finalUrl": "string",
  "domain": "string",
  "badge": "VERIFIED",
  "score": 85,
  "summary": "string",
  "timestamp": 1706961600000,
  "evidence": [ /* same normalized format as scan-evidence */ ],
  "scoreBreakdown": { ... }
}
```

### GET /scan-history?limit=100&offset=0
Response:
```json
{
  "ok": true,
  "items": [
    {
      "scanId": "uuid",
      "url": "string",
      "domain": "string",
      "title": "string",
      "badge": "VERIFIED",
      "score": 85,
      "summary": "string",
      "createdAt": "2024-02-03T12:00:00Z"
    }
  ],
  "total": 42,
  "limit": 100,
  "offset": 0
}
```

### POST /report-scan
Request:
```json
{
  "scan_id": "uuid (optional)",
  "url": "https://suspicious-site.com",
  "report_type": "scam" | "phishing" | "spam" | "misleading" | "safe" | "other",
  "description": "optional description"
}
```
Response:
```json
{
  "ok": true,
  "report_id": "uuid",
  "message": "Report submitted successfully",
  "total_reports": 5
}
```

### GET /quick-scan?url=https://example.com
Response:
```json
{
  "ok": true,
  "badge": "VERIFIED" | "UNVERIFIED" | "HIGH_RISK" | null,
  "score": 85 | null,
  "top_red_flags": ["Suspicious redirect pattern detected"],
  "scan_id": "uuid" | null,
  "cache_hit": true,
  "domain": "example.com"
}
```

### POST /cache-cleanup
Response:
```json
{
  "ok": true,
  "deleted": 42
}
```

If no cached/recent scan exists, `badge` and `score` are `null` with a `message` field suggesting a full scan.

## Database Tables

Run migrations in order:
1. `supabase/migrations/20240203_scan_tables.sql` — Core tables (scan_results, scan_evidence)
2. `supabase/migrations/20240204_scan_reports.sql` — Reports table (scan_reports, report_aggregates view)
3. `supabase/migrations/20240205_cache_schema_threat.sql` — Cache table + schema alignment + new providers
4. `supabase/migrations/20240206_rate_limits_telemetry.sql` — Rate limits + telemetry tables and view
5. `supabase/migrations/20240207_rate_limits_telemetry_update.sql` — Extended rate limits + telemetry metadata
6. `supabase/migrations/20240208_rate_limits_telemetry_phase1.sql` — Phase 1 schema alignment

Tables:
- `scan_results` — Main scan records
- `scan_evidence` — Evidence cards (card_title, card_status, card_payload columns)
- `scan_reports` — User-submitted reports (feeds into pattern_match + reputation_reports)
- `scan_cache` — URL scan cache (key, value jsonb, expires_at)
- `rate_limits` — Request counters for rate limiting (endpoint/device/ip windowed, count/limit)
- `scan_telemetry_events` — Telemetry events (endpoint, status, latency_ms, cache_hit)

Views:
- `scan_with_evidence` — Join of results + evidence
- `report_aggregates` — Report counts per URL/domain
- `telemetry_summary` — Daily summary by endpoint/device/ip (calls, latency, error rate, cache hit rate, rate-limit hits)

## Evidence Providers

| Provider | Source | Weight | Requires |
|----------|--------|--------|----------|
| `link_intel` | Redirect analysis | 25 | — |
| `domain_intel` | WHOIS + DNS + SSL | 30 | WHOIS_API_KEY (optional) |
| `pattern_match` | Keywords + known scams + reports | 20 | — |
| `google_safe_browsing` | Google Safe Browsing v4 | 15 | GOOGLE_SAFE_BROWSING_API_KEY |
| `virustotal` | VirusTotal URL scan | 15 | VIRUSTOTAL_API_KEY |
| `reputation_reports` | Community report aggregates | 10 | — |

If an external API key is missing, the provider returns `status: "unknown"`, `weight: 0`, `score_impact: 0` — no crash.

## Integrate REAiL in < 60 Minutes

Set these variables for all examples below:
```bash
BASE="https://<REF>.supabase.co/functions/v1"
KEY="eyJhbGci..."   # legacy anon public JWT
DEVICE="my-app-device-001"
```

### 1. Health Check (verify deployment)
```bash
curl -s "$BASE/content-scan?health" \
  -H "Authorization: Bearer $KEY" \
  -H "apikey: $KEY" | jq .
```

### 2. Full Scan (core flow)
```bash
curl -s -X POST "$BASE/content-scan" \
  -H "Authorization: Bearer $KEY" \
  -H "apikey: $KEY" \
  -H "X-Device-Id: $DEVICE" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' | jq .
```
Returns `scan_id`, `badge`, `score`, `evidence[]`, `score_breakdown`.

### 3. Fetch Result by ID
```bash
curl -s "$BASE/scan-result?scanId=<SCAN_ID>" \
  -H "Authorization: Bearer $KEY" \
  -H "apikey: $KEY" \
  -H "X-Device-Id: $DEVICE" | jq .
```

### 4. Fetch Evidence Cards
```bash
curl -s "$BASE/scan-evidence?scanId=<SCAN_ID>" \
  -H "Authorization: Bearer $KEY" \
  -H "apikey: $KEY" \
  -H "X-Device-Id: $DEVICE" | jq .
```

### 5. Quick Scan (for extensions / lightweight lookups)
```bash
curl -s "$BASE/quick-scan?url=https://example.com" \
  -H "Authorization: Bearer $KEY" \
  -H "apikey: $KEY" \
  -H "X-Device-Id: $DEVICE" | jq .
```
Fast cached response: `badge`, `score`, `top_red_flags`, `scan_id`.
Use this for browser extensions, bots, and real-time checks.

### 6. Submit Community Report
```bash
curl -s -X POST "$BASE/report-scan" \
  -H "Authorization: Bearer $KEY" \
  -H "apikey: $KEY" \
  -H "X-Device-Id: $DEVICE" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://suspicious-site.com", "report_type": "scam", "description": "Fake giveaway"}' | jq .
```

### 7. Scan History
```bash
curl -s "$BASE/scan-history?limit=20&offset=0" \
  -H "Authorization: Bearer $KEY" \
  -H "apikey: $KEY" \
  -H "X-Device-Id: $DEVICE" | jq .
```

### Recommended Usage Patterns

| Use Case | Endpoint | Notes |
|----------|----------|-------|
| Browser extension badge | `quick-scan` | Fast, cached, lightweight |
| Mobile app full scan | `content-scan` | Full evidence pack, deterministic scoring |
| Shared report link | `scan-result` | Fetch by scan_id for deep links |
| Dashboard / history | `scan-history` | Paginated, filtered by device_id |
| Community flagging | `report-scan` | Feeds into pattern_match provider |

### Caching & Timeouts

- `content-scan` caches results for 24h (configurable via `CACHE_TTL_HOURS` secret)
- `quick-scan` returns cached results instantly if available
- Recommended client timeout: 30s for `content-scan`, 10s for `quick-scan`
- If a scan is cached, the response includes `"cache_hit": true`

### Error Handling

All endpoints return errors in a standard format:
```json
{
  "message": "Human-readable error",
  "code": "ERROR_CODE",
  "details": "...",
  "hint": "..."
}
```
Always check HTTP status codes:
- `200` — Success
- `400` — Bad request (missing/invalid params)
- `401` — Unauthorized (bad or missing JWT)
- `404` — Not found (scan_id does not exist)
- `500` — Server error

### Future: Multi-Tenant Keys / Quotas

Planned (owned by CODEX):
- API keys per partner with usage quotas
- Rate limiting per key (requests/min, scans/day)
- Telemetry dashboard for partners
- Webhook notifications for watchlisted domains

## Browser Extension

See `extension/EXTENSION.md` for installation and configuration.

## Automated Test Script

```powershell
$env:SUPABASE_PROJECT_URL = "https://<REF>.supabase.co"
$env:SUPABASE_ANON_KEY    = "eyJhbGci..."   # legacy anon JWT
$env:FUNCTIONS_BASE_URL   = "https://<REF>.supabase.co/functions/v1"

pwsh scripts/tests.ps1
```

Runs: 6 health checks → content-scan → scan-evidence → report-scan → quick-scan. Exit code 1 on any failure.
