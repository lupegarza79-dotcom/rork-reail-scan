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
supabase secrets set URLSCAN_API_KEY=<key>
supabase secrets set GOOGLE_WEBRISK_API_KEY=<key>
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
| `URLSCAN_API_KEY` | Optional | urlscan.io API key for dynamic behavior analysis |
| `GOOGLE_WEBRISK_API_KEY` | Optional | Google Web Risk API key (used by quick-scan) |
| `VERBOSE_LOGGING` | Optional | Set `"true"` for detailed logs |

## Route Mapping

| Edge Function | Method | Auth | Description |
|---------------|--------|------|-------------|
| `content-scan` | POST | anon | Full scan: link intel + domain intel + pattern match + threat intel + reputation |
| `content-scan` | GET `?health` | anon | Health check |
| `scan-evidence` | GET `?scanId=` | anon | Fetch normalized evidence cards (device ownership enforced) |
| `scan-result` | GET `?scanId=` | anon | Fetch full scan result with evidence (device ownership enforced) |
| `scan-history` | GET `?limit=&offset=` | anon | Fetch scan history by device_id |
| `report-scan` | POST | anon | Submit user report for a URL (rate limited: 1/URL/device/24h) |
| `quick-scan` | GET/POST `?url=` | anon | Fast cached lookup for browser extensions |
| `wallet-share` | POST | anon | Create shareable link with scan verdict |
| `wallet-share` | GET `?token=` | anon | Resolve a share link |
| `money-case` | POST | anon | Create a money case and generate Rail Pack (rate limited) |
| `money-case` | GET `?case_id=` | anon | Fetch case with Rail Pack (device ownership enforced) |
| `appeal` | POST | anon | Submit scan appeal (rate limited: 5/device/hour) |
| `claim` | POST | anon | Submit domain claim (rate limited: 3/device/hour) |
| `cache-cleanup` | POST | **service-role** | Cleanup expired cache entries |
| `cache-cleanup` | GET `?health` | anon | Health check |
| `audit-run` | POST | **service-role** | Trigger an audit run |
| `outcome-update` | POST | **service-role** | Record a TrustOps outcome |
| `trustops-resolve-appeal` | POST | **service-role** | Resolve an appeal |
| `trustops-verify-claim` | POST | **service-role** | Verify/resolve a claim |
| `notify-send` | POST | **service-role** | Send a notification |

> **Auth levels:**
> - `anon` = Legacy anon JWT in Authorization + apikey headers
> - `service-role` = SERVICE_ROLE_KEY as Bearer token (returns 403 if anon key used)

## Deployment

```bash
# Public endpoints
supabase functions deploy content-scan --no-verify-jwt
supabase functions deploy scan-evidence --no-verify-jwt
supabase functions deploy scan-result --no-verify-jwt
supabase functions deploy scan-history --no-verify-jwt
supabase functions deploy report-scan --no-verify-jwt
supabase functions deploy quick-scan --no-verify-jwt
supabase functions deploy wallet-share --no-verify-jwt
supabase functions deploy money-case --no-verify-jwt
supabase functions deploy appeal --no-verify-jwt
supabase functions deploy claim --no-verify-jwt

# Service-role only endpoints (auth enforced in function code)
supabase functions deploy cache-cleanup --no-verify-jwt
supabase functions deploy audit-run --no-verify-jwt
supabase functions deploy outcome-update --no-verify-jwt
supabase functions deploy trustops-resolve-appeal --no-verify-jwt
supabase functions deploy trustops-verify-claim --no-verify-jwt
supabase functions deploy notify-send --no-verify-jwt
```

## Production Scheduler (Cache Cleanup)

Use pg_cron (recommended) or call the cache-cleanup Edge Function via cron.

### pg_cron Setup (run in Supabase SQL Editor)
```sql
-- Cache cleanup every 2 hours
SELECT cron.schedule('reail-cache-cleanup-2h', '0 */2 * * *', $SELECT cleanup_expired_cache()$);

-- Share links cleanup daily at 3 AM
SELECT cron.schedule('reail-share-cleanup-daily', '0 3 * * *', $SELECT cleanup_expired_share_links()$);

-- Rate limits cleanup every 6 hours
SELECT cron.schedule('reail-rate-limit-cleanup-6h', '0 */6 * * *', $SELECT cleanup_old_rate_limits()$);

-- Telemetry retention cleanup daily at 4 AM (30 day retention)
SELECT cron.schedule('reail-telemetry-cleanup-daily', '0 4 * * *', $SELECT cleanup_old_telemetry(30)$);

-- Or run all at once every 2 hours:
SELECT cron.schedule('reail-all-cleanup-2h', '0 */2 * * *', $SELECT run_all_cleanup()$);
```

### Verify Schedules
```sql
SELECT * FROM cron.job ORDER BY jobname;
```

### Edge Function Scheduler Alternative
```bash
# Requires service-role key as Bearer token
curl -X POST "$BASE/cache-cleanup" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Local Development (Windows)

### Quick Start
```powershell
pwsh scripts/dev.ps1          # pull, install, start tunnel
pwsh scripts/dev.ps1 -Web     # web mode
pwsh scripts/dev.ps1 -Clear   # clear cache
```

### Supabase Operations
```powershell
$env:SUPABASE_ACCESS_TOKEN = "<token>"
$env:SUPABASE_PROJECT_REF  = "<ref>"

pwsh scripts/supabase.ps1 -Action login
pwsh scripts/supabase.ps1 -Action link
pwsh scripts/supabase.ps1 -Action status    # migration list
pwsh scripts/supabase.ps1 -Action push      # apply migrations
pwsh scripts/supabase.ps1 -Action deploy    # deploy all functions
pwsh scripts/supabase.ps1 -Action all       # push + deploy
```

### Complete Edge Function Deploy List
```bash
# Deploy all functions
for fn in content-scan scan-evidence scan-result scan-history report-scan quick-scan cache-cleanup wallet-share money-case appeal claim audit-run outcome-update trustops-resolve-appeal trustops-verify-claim notify-send; do
  npx supabase functions deploy $fn --project-ref <REF> --no-verify-jwt
done
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

All public write endpoints enforce rate limits based on `X-Device-Id` + IP.

| Endpoint | Limit | Window |
|----------|-------|--------|
| `content-scan` | 30 requests | 60 min |
| `quick-scan` | 120 requests | 60 min |
| `report-scan` | 1 per URL per device | 24 hours |
| `appeal` | 5 per device | 60 min |
| `claim` | 3 per device | 60 min |
| `money-case` | 10 per device | 60 min |
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

### POST /wallet-share
Create a shareable link for a URL. Leverages quick-scan cache/DB lookup internally.

Request:
```json
{
  "url": "https://example.com",
  "expiry_hours": 72
}
```
Response (201):
```json
{
  "ok": true,
  "token": "aBc123XyZ",
  "share_url": "/s/aBc123XyZ",
  "original_url": "https://example.com",
  "domain": "example.com",
  "badge": "VERIFIED" | "UNVERIFIED" | "HIGH_RISK" | null,
  "score": 85 | null,
  "top_red_flags": ["Suspicious redirect detected"],
  "next_action": "This link appears safe, but always verify unexpected requests.",
  "expires_at": "2024-02-06T12:00:00.000Z",
  "needs_full_scan": false
}
```

### GET /wallet-share?token=aBc123XyZ
Resolve a share link and get the scan verdict.

Response:
```json
{
  "ok": true,
  "token": "aBc123XyZ",
  "original_url": "https://example.com",
  "domain": "example.com",
  "badge": "VERIFIED",
  "score": 85,
  "top_red_flags": [],
  "next_action": "This link appears safe.",
  "scan_id": "uuid" | null,
  "created_at": "2024-02-03T12:00:00.000Z",
  "expires_at": "2024-02-06T12:00:00.000Z",
  "view_count": 5
}
```

Error responses:
- `404` - Share link not found
- `410` - Share link expired

### POST /money-case
Create a money case (refund/dispute) and generate a Rail Pack.

Request:
```json
{
  "share_token": "aBc123XyZ",
  "issue_type": "product_not_received",
  "amount_cents": 4999,
  "currency": "USD",
  "transaction_date": "2024-01-15",
  "payment_method": "credit_card",
  "merchant_name": "ShopXYZ",
  "merchant_url": "https://shopxyz.com",
  "description": "Never received my order",
  "desired_outcome": "full_refund",
  "locale": "en"
}
```
Response (201):
```json
{
  "ok": true,
  "case_id": "uuid",
  "status": "submitted",
  "rail_pack": {
    "locale": "en",
    "generated_at": "2024-02-03T12:00:00.000Z",
    "refund_request_template": "Subject: Refund Request...",
    "follow_up_template": "Subject: Follow-Up...",
    "escalation_checklist": ["..."],
    "evidence_checklist": ["..."],
    "disclaimer": "DISCLAIMER: This information is for guidance only..."
  },
  "created_at": "2024-02-03T12:00:00.000Z"
}
```

### GET /money-case?case_id=uuid
Fetch a money case with its Rail Pack, events timeline, and artifacts.

Response:
```json
{
  "ok": true,
  "case": {
    "id": "uuid",
    "share_token": "aBc123XyZ",
    "issue_type": "product_not_received",
    "status": "submitted",
    "amount_cents": 4999,
    "currency": "USD",
    "transaction_date": "2024-01-15",
    "payment_method": "credit_card",
    "merchant_name": "ShopXYZ",
    "merchant_url": "https://shopxyz.com",
    "description": "Never received my order",
    "desired_outcome": "full_refund",
    "locale": "en",
    "created_at": "2024-02-03T12:00:00.000Z",
    "updated_at": "2024-02-03T12:00:00.000Z"
  },
  "rail_pack": { "...same as POST response..." },
  "events": [
    {
      "id": "uuid",
      "case_id": "uuid",
      "event_type": "case_created",
      "title": "Case Created",
      "description": "Rail Pack generated with templates and checklists",
      "metadata": {},
      "created_at": "2024-02-03T12:00:00.000Z"
    }
  ],
  "artifacts": []
}
```

## Database Tables

Run migrations in order:
1. `20240203_scan_tables.sql` — Core tables (scan_results, scan_evidence)
2. `20240204_scan_reports.sql` — Reports table (scan_reports, report_aggregates view)
3. `20240205_cache_schema_threat.sql` — Cache table + schema alignment + new providers
4. `20240206_rate_limits_telemetry.sql` — Rate limits + telemetry tables and view
5. `20240207_rate_limits_telemetry_update.sql` — Extended rate limits + telemetry metadata
6. `20240208_rate_limits_telemetry_phase1.sql` — Phase 1 schema alignment
7. `20240209_wallet_share_links.sql` — Wallet share links for viral distribution
8. `20240210_money_cases.sql` — Money cases for refund/dispute Rail Packs
9. `20240211_placeholder.sql` — Placeholder
10. `20240212_trust_graph.sql` — Domain trust profiles + graph edges + relationships
11. `20240213_rls_wallet_money_cleanup.sql` — RLS policies + cleanup functions
12. `20240214_trustops_tables.sql` — TrustOps audit runs, outcomes, notifications
13. `20240215_production_hardening.sql` — **Fix-forward**: consolidate rate_limits/telemetry drift, enhanced telemetry_summary, pg_cron setup

**All migrations are idempotent** — they use `IF NOT EXISTS`, `DO $ ... EXCEPTION` guards,
and `CREATE OR REPLACE` for functions/views. Safe to re-run against an existing DB.

### Migration Repair (existing DB)

If `supabase db push` fails because tables already exist, baseline each applied migration:

```bash
# List migration status
npx supabase migration list --project-ref <REF>

# Mark each existing migration as applied
npx supabase migration repair --status applied 20240203 --project-ref <REF>
npx supabase migration repair --status applied 20240204 --project-ref <REF>
# ... continue for all applied migrations

# Then push remaining
npx supabase db push --project-ref <REF>
```

Or use the PowerShell script:
```powershell
pwsh scripts/supabase.ps1 -Action status
pwsh scripts/supabase.ps1 -Action repair -MigrationVersion 20240203
pwsh scripts/supabase.ps1 -Action push
```

Tables:
- `scan_results` — Main scan records
- `scan_evidence` — Evidence cards (card_title, card_status, card_payload columns)
- `scan_reports` — User-submitted reports (feeds into pattern_match + reputation_reports)
- `scan_cache` — URL scan cache (key, value jsonb, expires_at)
- `rate_limits` — Request counters for rate limiting (endpoint/device/ip windowed, count/limit)
- `scan_telemetry_events` — Telemetry events (endpoint, status, latency_ms, cache_hit)
- `wallet_share_links` — Shareable verdict links (token, original_url, scan_id, badge, score, expires_at)
- `money_cases` — Payment dispute cases for Rail Pack generation
- `case_events` — Timeline events for money cases
- `case_artifacts` — Uploaded proof/documents for cases

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
| Shareable verdict link | `wallet-share` | Viral distribution, OG preview cards |
| Refund/dispute case | `money-case` | Create case + get Rail Pack templates |

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

## Telemetry Debug Queries

```sql
-- Overall volume + error rate by endpoint (last 24h)
SELECT endpoint, total_calls, error_count, error_rate, cache_hit_rate, rate_limit_hits
FROM telemetry_summary
WHERE bucket >= NOW() - INTERVAL '1 day'
ORDER BY total_calls DESC;

-- Top errors by endpoint
SELECT endpoint, error_code, COUNT(*) AS cnt
FROM scan_telemetry_events
WHERE status = 'error' AND created_at > NOW() - INTERVAL '1 day'
GROUP BY 1, 2 ORDER BY cnt DESC LIMIT 20;

-- Provider latency (last 24h)
SELECT provider, COUNT(*) AS calls,
  ROUND(AVG(latency_ms)::NUMERIC, 0) AS avg_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::NUMERIC, 0) AS p95_ms
FROM scan_telemetry_events
WHERE event_type = 'provider' AND created_at > NOW() - INTERVAL '1 day'
GROUP BY 1 ORDER BY avg_ms DESC;

-- Rate limit violations (last 24h)
SELECT endpoint, device_id, ip, COUNT(*) AS violations
FROM scan_telemetry_events
WHERE status = 'rate_limited' AND created_at > NOW() - INTERVAL '1 day'
GROUP BY 1, 2, 3 ORDER BY violations DESC LIMIT 20;
```

## Automated Test Script

```powershell
$env:SUPABASE_PROJECT_URL = "https://<REF>.supabase.co"
$env:SUPABASE_ANON_KEY    = "eyJhbGci..."   # legacy anon JWT
$env:FUNCTIONS_BASE_URL   = "https://<REF>.supabase.co/functions/v1"

pwsh scripts/tests.ps1
```

Runs: health checks → content-scan → scan-evidence → report-scan → quick-scan. Exit code 1 on any failure.

## Security Model

### Public Endpoints (anon key)
- Scan operations: `content-scan`, `quick-scan`, `scan-result`, `scan-evidence`, `scan-history`
- User actions: `report-scan`, `appeal`, `claim`
- Wallet: `wallet-share`, `money-case`

### Privileged Endpoints (service-role key required)
These endpoints return **403 Forbidden** if called with the anon key:
- `trustops-resolve-appeal` — Resolve appeals
- `trustops-verify-claim` — Verify domain claims
- `audit-run` — Trigger audit runs
- `outcome-update` — Record TrustOps outcomes
- `notify-send` — Send notifications
- `cache-cleanup` (POST) — Run cleanup (GET health is public)

### Data Access Control
- `scan-result`: Returns data to the scan's device owner, or to any authenticated device if device_id was not "anonymous"
- `scan-evidence`: Strict device_id match required
- `money-case` GET: Device ownership enforced
- `scan-history`: Filtered by device_id header
