# REAiL Trust Infrastructure — Runbook

## Quick Start (Fresh Dev)

```bash
# 1. Clone
git clone https://github.com/lupegarza79-dotcom/rork-reail-scan.git
cd rork-reail-scan

# 2. Link Supabase
npx supabase link --project-ref favpzctusdjnnoyoabrz

# 3. Push migrations
npx supabase db push --linked --include-all

# 4. Set secrets
npx supabase secrets set PROJECT_URL=https://favpzctusdjnnoyoabrz.supabase.co
npx supabase secrets set SERVICE_ROLE_KEY=<your_service_role_key>
npx supabase secrets set GOOGLE_WEBRISK_API_KEY=<key>
npx supabase secrets set GOOGLE_SAFE_BROWSING_API_KEY=<key>
npx supabase secrets set VIRUSTOTAL_API_KEY=<key>
npx supabase secrets set URLSCAN_API_KEY=<key>
npx supabase secrets set WHOIS_API_KEY=<key>
npx supabase secrets set CACHE_TTL_HOURS=24
npx supabase secrets set VERBOSE_LOGGING=true

# 5. Deploy all edge functions
npx supabase functions deploy quick-scan --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy content-scan --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy scan-result --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy scan-evidence --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy scan-history --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy report-scan --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy wallet-share --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy appeal --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy claim --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy money-case --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy cache-cleanup --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy audit-run --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy outcome-update --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy notify-send --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy trustops-resolve-appeal --project-ref favpzctusdjnnoyoabrz
npx supabase functions deploy trustops-verify-claim --project-ref favpzctusdjnnoyoabrz

# 6. Run app
bun install
bun start

# 7. Run tests
pwsh scripts/tests.ps1
```

## Env Vars / Secrets Required

| Secret | Required | Where | Description |
|--------|----------|-------|-------------|
| `PROJECT_URL` | Yes | Supabase secrets | `https://<ref>.supabase.co` |
| `SERVICE_ROLE_KEY` | Yes | Supabase secrets | Service role key |
| `GOOGLE_WEBRISK_API_KEY` | Yes | Supabase secrets | Google Web Risk (quick-scan) |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Recommended | Supabase secrets | Google Safe Browsing v4 (content-scan) |
| `VIRUSTOTAL_API_KEY` | Recommended | Supabase secrets | VirusTotal v3 API key |
| `URLSCAN_API_KEY` | Recommended | Supabase secrets | urlscan.io API key |
| `WHOIS_API_KEY` | Optional | Supabase secrets | WhoisXML API for domain age |
| `CACHE_TTL_HOURS` | Optional | Supabase secrets | Default: 24 |
| `VERBOSE_LOGGING` | Optional | Supabase secrets | `"true"` for debug logs |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | App .env | Anon public JWT |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | App .env | Supabase project URL |
| `EXPO_PUBLIC_API_URL` | Yes | App .env | Functions base URL |

## Security Model

### Public endpoints (anon JWT)
- `quick-scan` — Rate limited: 120/hour per device+IP
- `content-scan` — Rate limited: 30/hour per device+IP
- `report-scan` — Rate limited: 20/hour per device+IP + 1/URL/device/24h
- `appeal` — Rate limited: 5/hour per device
- `claim` — Rate limited: 3/hour per device
- `money-case` — Rate limited: 10/hour per device
- `scan-result`, `scan-evidence` — Device ownership enforced (x-device-id)
- `scan-history` — Device ownership enforced (x-device-id required)
- `wallet-share` GET — Public via share token

### Privileged endpoints (service-role Bearer token)
- `trustops-resolve-appeal` — Resolve appeals
- `trustops-verify-claim` — Verify domain claims
- `audit-run` — Trigger audit runs
- `outcome-update` — Record TrustOps outcomes
- `notify-send` — Send notifications
- `cache-cleanup` — Run cleanup (also callable via pg_cron)

All privileged endpoints return `403 { ok:false, error_code:"forbidden" }` without valid service-role token.

### 429 Response Shape (stable contract)
```json
{
  "ok": false,
  "error_code": "rate_limit_exceeded",
  "message": "Rate limit exceeded",
  "endpoint": "<endpoint-name>",
  "retry_after_seconds": 1234,
  "rate_limit": {
    "remaining": 0,
    "limit": 120,
    "window_seconds": 3600
  }
}
```

## Threat Intelligence Providers

| Provider | Endpoint | Type | API Key Required |
|----------|----------|------|-----------------|
| Google Web Risk | quick-scan | Threat lookup | Yes |
| Google Safe Browsing | content-scan | Threat database | Yes |
| VirusTotal | content-scan | Multi-vendor reputation | Yes |
| urlscan.io | content-scan | Dynamic behavior analysis | Yes |
| URLhaus (abuse.ch) | quick-scan, content-scan | Community threat feed | No (free API) |
| OpenPhish | content-scan | Phishing feed | No (free feed) |
| Link Intel | content-scan | Redirect/shortlink analysis | No |
| Domain Intel | content-scan | WHOIS + DNS + SSL | Optional (WHOIS key) |
| Pattern Match | content-scan | Keyword + known scam DB | No |
| Content Intel | content-scan | Page content analysis | No |
| Community Reports | content-scan | User report aggregation | No |

All providers use `Promise.allSettled` / fail-soft pattern. A provider failure degrades that signal to `status: "unknown"` with `weight: 0`, never crashes the scan.

## Telemetry

### Schema: `scan_telemetry_events`
| Column | Type | Description |
|--------|------|-------------|
| `trace_id` | TEXT | Request-level trace ID |
| `endpoint` | TEXT | Edge function name |
| `event_type` | TEXT | `scan`, `provider`, `report` |
| `provider` | TEXT | Provider name (for event_type=provider) |
| `device_id` | TEXT | Client device ID |
| `ip` | TEXT | Client IP |
| `status` | TEXT | `ok`, `error`, `rate_limited` |
| `latency_ms` | INT | Request/provider latency |
| `cache_hit` | BOOL | Whether cache was used |
| `score` | INT | Scan score (0-100) |
| `badge` | TEXT | VERIFIED/UNVERIFIED/HIGH_RISK |
| `error_code` | TEXT | Error code if failed |
| `metadata` | JSONB | Extra context |

### Dashboard Queries
```sql
-- Hourly scan volume + cache hit rate
SELECT * FROM telemetry_dashboard ORDER BY bucket DESC LIMIT 48;

-- Provider performance (latency + error rate)
SELECT * FROM provider_dashboard ORDER BY bucket DESC LIMIT 48;

-- Top errors in last 24h
SELECT endpoint, error_code, COUNT(*) as cnt
FROM scan_telemetry_events
WHERE status = 'error' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2 ORDER BY cnt DESC LIMIT 20;

-- Rate limit hits by endpoint
SELECT endpoint, COUNT(*) as hits
FROM scan_telemetry_events
WHERE status = 'rate_limited' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1 ORDER BY hits DESC;
```

## Cache & Scheduler

### Cache
- `scan_cache` table with TTL-based expiry (default 24h)
- Indexed on `(key, expires_at)` for fast lookups
- `cleanup_expired_cache()` RPC removes expired entries

### Scheduled Cleanup
PROD cron jobs (verify in Supabase Dashboard > Database > Extensions > pg_cron):
- `reail_cleanup_old_scans_daily` — Runs daily, deletes scans older than 8 days
- `reail_cleanup_expired_cache_hourly` — Runs hourly, cleans expired cache

To verify cron jobs exist:
```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE 'reail_%';
```

To manually trigger full cleanup:
```sql
SELECT public.run_all_cleanup();
```

Or via edge function:
```bash
curl -X POST https://favpzctusdjnnoyoabrz.supabase.co/functions/v1/cache-cleanup \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json"
```

## Verification Checklist

```bash
# 1. Migrations applied
npx supabase db push --linked --include-all
# Expected: "All migrations applied" or specific migration names

# 2. Health checks (all should return { ok: true })
ENDPOINTS="quick-scan content-scan scan-result scan-evidence scan-history report-scan wallet-share appeal claim money-case cache-cleanup audit-run outcome-update notify-send trustops-resolve-appeal trustops-verify-claim"
for ep in $ENDPOINTS; do
  curl -s "https://favpzctusdjnnoyoabrz.supabase.co/functions/v1/$ep?health=1" \
    -H "apikey: <ANON_KEY>" | jq .ok
done

# 3. Quick-scan works
curl -s "https://favpzctusdjnnoyoabrz.supabase.co/functions/v1/quick-scan?url=https://example.com" \
  -H "apikey: <ANON_KEY>" \
  -H "x-device-id: test-123" | jq '{trust_score: .trust.score, providers: (.providers | keys)}'

# 4. Content-scan works
curl -s -X POST "https://favpzctusdjnnoyoabrz.supabase.co/functions/v1/content-scan" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "x-device-id: test-123" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | jq '{ok, badge, score, providers: [.evidence[].provider]}'

# 5. Telemetry flowing
psql <DB_URL> -c "SELECT COUNT(*) FROM scan_telemetry_events WHERE created_at > NOW() - INTERVAL '1 hour';"

# 6. Cron jobs exist
psql <DB_URL> -c "SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'reail_%';"

# 7. Run full test suite
pwsh scripts/tests.ps1
```

## Rollback

### Revert edge functions
Re-deploy the previous version of any function from git:
```bash
git checkout HEAD~1 -- supabase/functions/<function-name>/index.ts
npx supabase functions deploy <function-name> --project-ref favpzctusdjnnoyoabrz
```

### Revert migration
The migration `20260220_trust_infra_hardening.sql` is purely additive (indexes, columns, functions, views). Safe to leave in place. If needed:
```sql
-- Drop new views
DROP VIEW IF EXISTS telemetry_dashboard;
DROP VIEW IF EXISTS provider_dashboard;

-- Drop new functions (cleanup RPCs already existed, these are replacements)
-- Only drop if you want to revert to old versions:
-- DROP FUNCTION IF EXISTS public.run_all_cleanup();

-- Indexes are harmless to leave; to drop:
-- DROP INDEX IF EXISTS idx_telemetry_trace_id;
-- DROP INDEX IF EXISTS idx_telemetry_endpoint_created;
-- DROP INDEX IF EXISTS idx_scan_cache_key_expires;
-- DROP INDEX IF EXISTS idx_rate_limits_lookup;

-- Columns are harmless to leave (nullable):
-- ALTER TABLE scan_telemetry_events DROP COLUMN IF EXISTS trace_id;
-- ALTER TABLE scan_telemetry_events DROP COLUMN IF EXISTS metadata;
```

No destructive changes were made. All existing tables, columns, and RPC contracts are preserved.
