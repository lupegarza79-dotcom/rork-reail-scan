# Supabase Edge Functions & Go-Live Runbook (Windows-first)

## Project
- **Project ref:** `favpzctusdjnnoyoabrz`
- **Functions base URL:** `https://favpzctusdjnnoyoabrz.supabase.co/functions/v1`

## Required Headers (client endpoints)
```http
Authorization: Bearer <LEGACY_ANON_JWT>
apikey: <LEGACY_ANON_JWT>
X-Device-Id: <device-uuid>
Content-Type: application/json
```

> Use legacy anon JWT (`eyJ...`), not `sb_publishable_*`.

## Security gates
- TrustOps/admin/ops endpoints (if present in your deployment): require `TRUSTOPS_ADMIN_TOKEN` and `Authorization: Bearer <token>`.
- `scan-result` requires either:
  - ownership (`X-Device-Id` matches scan `device_id`), or
  - valid explicit `shareToken` (query/header) matching `scan_results.share_token` and not expired.

## Function list (current repo)
- `content-scan`
- `scan-evidence`
- `scan-result`
- `scan-history`
- `report-scan`
- `quick-scan`
- `cache-cleanup`

## Migrations (chronological, additive, idempotent)
1. `20240203_scan_tables.sql` — Core scan tables + enums + RLS + `scan_with_evidence` view.
2. `20240204_scan_reports.sql` — `scan_reports` table + report aggregates view.
3. `20240205_cache_schema_threat.sql` — cache table + provider/status alignment + cleanup RPC.
4. `20240206_rate_limits_telemetry.sql` — initial `rate_limits` + telemetry table and summary view.
5. `20240207_rate_limits_telemetry_update.sql` — telemetry/rate-limit metadata extension.
6. `20240208_rate_limits_telemetry_phase1.sql` — endpoint/status alignment for telemetry/rate limits.
7. `20240215_production_hardening.sql` — safe telemetry view rebuild + share-token columns/index.
8. `20240216_trustops_compat_fix.sql` — fix-forward `appeals.device_id` and `claims.device_id` + indexes.

## Go-live runbook (PowerShell 5/7, copy/paste)
```powershell
cd C:\reail
supabase login
supabase link --project-ref favpzctusdjnnoyoabrz
supabase db push --linked --dry-run
supabase db push --linked
```

### Deploy all functions (PowerShell, no bash)
```powershell
$ref = "favpzctusdjnnoyoabrz"
$funcs = @(
  "content-scan","scan-evidence","scan-result","scan-history",
  "report-scan","quick-scan","cache-cleanup"
)

foreach ($fn in $funcs) {
  Write-Host "Deploying $fn..."
  supabase functions deploy $fn --project-ref $ref --no-verify-jwt
}
```

### Set secrets
```powershell
$token = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))

supabase secrets set PROJECT_URL="https://favpzctusdjnnoyoabrz.supabase.co" --project-ref favpzctusdjnnoyoabrz
supabase secrets set SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>" --project-ref favpzctusdjnnoyoabrz
supabase secrets set TRUSTOPS_ADMIN_TOKEN="$token" --project-ref favpzctusdjnnoyoabrz
```

### Health checks (PowerShell, no jq)
```powershell
$base = "https://favpzctusdjnnoyoabrz.supabase.co/functions/v1"
$funcs = @("content-scan","scan-evidence","scan-result","scan-history","report-scan","quick-scan","cache-cleanup")

foreach ($fn in $funcs) {
  try {
    $r = Invoke-RestMethod "$base/$fn?health=1" -Method GET
    Write-Host "OK $fn => endpoint=$($r.endpoint) ok=$($r.ok)"
  } catch {
    Write-Host "FAIL $fn => $($_.Exception.Message)"
  }
}
```

### Tests
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\tests.ps1
```

## Troubleshooting
- **404 on `/functions/v1/<fn>?health=1`** → function not deployed or wrong project ref/base URL.
- **`Entrypoint path does not exist` in deploy** → running outside repo root; use `scripts\sb-deploy-all.ps1` (self-roots).
- **`pwsh` not recognized** → use Windows PowerShell command above (`powershell -ExecutionPolicy Bypass ...`).
- **`column device_id does not exist` (appeals/claims index)** → apply fix-forward migration `20240216_trustops_compat_fix.sql` via `supabase db push --linked`.
- **`cannot change name of view column ... function_name to endpoint`** → resolved by `20240215_production_hardening.sql` (drops/recreates `telemetry_summary`).
- **Docker warning** → start Docker Desktop and confirm with `docker info`.
