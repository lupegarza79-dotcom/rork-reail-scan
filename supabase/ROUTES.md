# Supabase Edge Function Routes

## Base URL Configuration

Update `utils/api.ts` to use your Supabase Edge Functions URL:

```ts
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://<PROJECT_REF>.supabase.co/functions/v1";
```

## Route Mapping

| App Endpoint | Edge Function | Method | Description |
|--------------|---------------|--------|-------------|
| `/scan/content` | `content-scan` | POST | Full scan with Link Intel + Domain Intel |
| `/scan/evidence` | `scan-evidence` | GET | Fetch evidence by scanId |
| `/scan/result` | `scan-result` | GET | Fetch full scan result with evidence |
| `/scan/history` | `scan-history` | GET | Fetch scan history by device_id |
| `/report-scan` | `report-scan` | POST | Submit user report for a URL |

## Deployment Commands

```bash
# Deploy all functions
supabase functions deploy content-scan
supabase functions deploy scan-evidence
supabase functions deploy scan-result
supabase functions deploy scan-history
supabase functions deploy report-scan

# Set required secrets
supabase secrets set PROJECT_URL=https://<REF>.supabase.co
supabase secrets set SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set WHOIS_API_KEY=your_whois_api_key
```

## Environment Variables

Edge Functions use these secrets (set via `supabase secrets set`):
- `PROJECT_URL` - Your Supabase project URL (e.g. `https://<REF>.supabase.co`)
- `SERVICE_ROLE_KEY` - Service role key for DB access

> **Do NOT use `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`** — Supabase rejects
> secret names prefixed with `SUPABASE_`.

Optional:
- `WHOIS_API_KEY` - WhoisXML API key for domain age lookups
- `VERBOSE_LOGGING` - Set to `"true"` for detailed function logs

## Authentication & Request Headers

All endpoints expect **both** auth headers plus device ID:
```
Authorization: Bearer <LEGACY_ANON_JWT>
apikey: <LEGACY_ANON_JWT>
X-Device-Id: <device-uuid>
Content-Type: application/json
```

> **Important:** Use the **Legacy anon (public) JWT** (starts with `eyJhbGci...`) for
> **both** `Authorization` and `apikey` headers. The newer publishable key
> (`sb_publishable_...`) is **not** a JWT and will be rejected by Supabase's
> `verify_jwt` gateway. You can find the legacy key in your Supabase dashboard
> under **Settings → API → Project API keys → anon / public**.

## Response Types

### POST /scan/content
Request:
```json
{ "url": "https://example.com" }
```

Response (`ContentScanResponse`):
```json
{
  "scan_id": "uuid",
  "badge": "VERIFIED" | "UNVERIFIED" | "HIGH_RISK",
  "score": 0-100,
  "summary": "string",
  "evidence": [
    {
      "provider": "link_intel" | "domain_intel" | "pattern_match",
      "status": "pass" | "warn" | "fail",
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

### GET /scan/evidence?scanId=uuid
Response:
```json
{
  "evidence": [
    {
      "provider": "link_intel",
      "status": "pass",
      "summary": "URL passed link analysis",
      "weight": 25,
      "payload": { ... }
    }
  ]
}
```

### GET /scan/result?scanId=uuid
Response (`BackendScanResult`):
```json
{
  "id": "uuid",
  "url": "string",
  "finalUrl": "string",
  "domain": "string",
  "badge": "VERIFIED",
  "score": 85,
  "summary": "string",
  "timestamp": 1234567890,
  "evidence": [...],
  "scoreBreakdown": { ... }
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

Response (`ReportScanResponse`):
```json
{
  "report_id": "uuid",
  "message": "Report submitted successfully",
  "total_reports": 5
}
```

## Database Tables

Run migrations in order:
1. `supabase/migrations/20240203_scan_tables.sql` - Core tables
2. `supabase/migrations/20240204_scan_reports.sql` - Reports table

Tables created:
- `scan_results` - Main scan records
- `scan_evidence` - Evidence cards linked to scans
- `scan_reports` - User-submitted reports (feeds into pattern_match)
- `scan_with_evidence` - View joining results + evidence
- `report_aggregates` - View with report counts per URL/domain

## Health Checks

Every function exposes a `GET ?health` endpoint:
```bash
curl "https://<PROJECT_REF>.supabase.co/functions/v1/content-scan?health"
curl "https://<PROJECT_REF>.supabase.co/functions/v1/scan-evidence?health"
curl "https://<PROJECT_REF>.supabase.co/functions/v1/scan-result?health"
curl "https://<PROJECT_REF>.supabase.co/functions/v1/scan-history?health"
curl "https://<PROJECT_REF>.supabase.co/functions/v1/report-scan?health"
```

Response:
```json
{
  "status": "ok",
  "function": "<name>",
  "secrets": { "PROJECT_URL": true, "SERVICE_ROLE_KEY": true },
  "timestamp": "2024-02-03T12:00:00.000Z"
}
```

## Testing

```bash
# Test content-scan
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/content-scan \
  -H "Authorization: Bearer eyJhbGci...YOUR_LEGACY_ANON_JWT" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device" \
  -d '{"url": "https://example.com"}'

# Test scan-evidence
curl "https://<PROJECT_REF>.supabase.co/functions/v1/scan-evidence?scanId=<SCAN_ID>" \
  -H "Authorization: Bearer eyJhbGci...YOUR_LEGACY_ANON_JWT" \
  -H "X-Device-Id: test-device"

# Test scan-history
curl "https://<PROJECT_REF>.supabase.co/functions/v1/scan-history?limit=50" \
  -H "Authorization: Bearer eyJhbGci...YOUR_LEGACY_ANON_JWT" \
  -H "X-Device-Id: test-device"

# Test report-scan
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/report-scan \
  -H "Authorization: Bearer eyJhbGci...YOUR_LEGACY_ANON_JWT" \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device" \
  -d '{"url": "https://suspicious-site.com", "report_type": "scam"}'
```

## Automated Test Script

A PowerShell test script is available at `scripts/tests.ps1`. It runs health checks,
a full scan, evidence retrieval, and a report submission.

```powershell
$env:SUPABASE_PROJECT_URL = "https://<REF>.supabase.co"
$env:SUPABASE_ANON_KEY    = "eyJhbGci..."   # legacy anon JWT
$env:FUNCTIONS_BASE_URL   = "https://<REF>.supabase.co/functions/v1"

pwsh scripts/tests.ps1
```

### GET /scan/history?limit=100&offset=0
Response (`ScanHistoryResponse`):
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
