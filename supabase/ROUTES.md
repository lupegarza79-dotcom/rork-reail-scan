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

## Deployment

```bash
supabase functions deploy content-scan
supabase functions deploy scan-evidence
supabase functions deploy scan-result
supabase functions deploy scan-history
supabase functions deploy report-scan
supabase functions deploy quick-scan
```

## Health Checks

Every function exposes `GET ?health`:
```json
{
  "status": "ok",
  "function": "<name>",
  "secrets": { "PROJECT_URL": true, "SERVICE_ROLE_KEY": true },
  "timestamp": "2024-02-03T12:00:00.000Z"
}
```

content-scan health also reports: `GOOGLE_SAFE_BROWSING_API_KEY`, `VIRUSTOTAL_API_KEY`, `CACHE_TTL_HOURS`.

## Standardized Error Format

All functions return errors as:
```json
{
  "message": "Human-readable error",
  "code": "ERROR_CODE or PostgREST code",
  "details": "Additional details or null",
  "hint": "Fix suggestion or null"
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
  "report_id": "uuid",
  "message": "Report submitted successfully",
  "total_reports": 5
}
```

### GET /quick-scan?url=https://example.com
Response:
```json
{
  "badge": "VERIFIED" | "UNVERIFIED" | "HIGH_RISK" | null,
  "score": 85 | null,
  "top_red_flags": ["Suspicious redirect pattern detected"],
  "scan_id": "uuid" | null,
  "cache_hit": true,
  "domain": "example.com"
}
```

If no cached/recent scan exists, `badge` and `score` are `null` with a `message` field suggesting a full scan.

## Database Tables

Run migrations in order:
1. `supabase/migrations/20240203_scan_tables.sql` — Core tables (scan_results, scan_evidence)
2. `supabase/migrations/20240204_scan_reports.sql` — Reports table (scan_reports, report_aggregates view)
3. `supabase/migrations/20240205_cache_schema_threat.sql` — Cache table + schema alignment + new providers

Tables:
- `scan_results` — Main scan records
- `scan_evidence` — Evidence cards (card_title, card_status, card_payload columns)
- `scan_reports` — User-submitted reports (feeds into pattern_match + reputation_reports)
- `scan_cache` — URL scan cache (key, value jsonb, expires_at)

Views:
- `scan_with_evidence` — Join of results + evidence
- `report_aggregates` — Report counts per URL/domain

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

## Automated Test Script

```powershell
$env:SUPABASE_PROJECT_URL = "https://<REF>.supabase.co"
$env:SUPABASE_ANON_KEY    = "eyJhbGci..."   # legacy anon JWT
$env:FUNCTIONS_BASE_URL   = "https://<REF>.supabase.co/functions/v1"

pwsh scripts/tests.ps1
```

Runs: 6 health checks → content-scan → scan-evidence → report-scan → quick-scan. Exit code 1 on any failure.
