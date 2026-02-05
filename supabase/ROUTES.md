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

## Deployment Commands

```bash
# Deploy all functions
supabase functions deploy content-scan
supabase functions deploy scan-evidence
supabase functions deploy scan-result
supabase functions deploy scan-history

# Set secrets (required for content-scan)
supabase secrets set WHOIS_API_KEY=your_whois_api_key
```

## Environment Variables

Edge Functions require these env vars (auto-available in Supabase):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for DB access

Optional (for enhanced domain intel):
- `WHOIS_API_KEY` - WhoisXML API key for domain age lookups

## Request Headers

All endpoints expect:
```
X-Device-Id: <device-uuid>
Content-Type: application/json
```

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
      "provider": "link_intel" | "domain_intel",
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

## Database Tables

Run `supabase/migrations/20240203_scan_tables.sql` to create:
- `scan_results` - Main scan records
- `scan_evidence` - Evidence cards linked to scans
- `scan_with_evidence` - View joining both

## Testing

```bash
# Test content-scan
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/content-scan \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device" \
  -d '{"url": "https://example.com"}'

# Test scan-evidence
curl "https://<PROJECT_REF>.supabase.co/functions/v1/scan-evidence?scanId=<SCAN_ID>" \
  -H "X-Device-Id: test-device"

# Test scan-history
curl "https://<PROJECT_REF>.supabase.co/functions/v1/scan-history?limit=50" \
  -H "X-Device-Id: test-device"
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
