#Requires -Version 5.1
param()

$ErrorActionPreference = "Stop"

# --- Required env vars ---
$projectUrl    = $env:SUPABASE_PROJECT_URL
$anonKey       = $env:SUPABASE_ANON_KEY
$functionsBase = $env:FUNCTIONS_BASE_URL

if (-not $projectUrl)    { Write-Error "Missing env var SUPABASE_PROJECT_URL"; exit 1 }
if (-not $anonKey)       { Write-Error "Missing env var SUPABASE_ANON_KEY (legacy eyJ...)"; exit 1 }
if (-not $functionsBase) { Write-Error "Missing env var FUNCTIONS_BASE_URL (https://<project>.supabase.co/functions/v1)"; exit 1 }

if (-not $anonKey.StartsWith("eyJ")) {
    Write-Warning "SUPABASE_ANON_KEY does not start with 'eyJ' — make sure you are using the legacy anon JWT, not sb_publishable_*"
}

$functionsBase = $functionsBase.TrimEnd("/")
$deviceId = [guid]::NewGuid().ToString()

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  REAiL Edge Functions Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Functions Base : $functionsBase"
Write-Host "Device ID      : $deviceId"
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $anonKey"
    "apikey"        = $anonKey
    "X-Device-Id"   = $deviceId
    "Content-Type"  = "application/json"
}

$results = [ordered]@{}
$scanId  = $null

function Invoke-Step {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Uri,
        [string]$Body,
        [hashtable]$OverrideHeaders,
        [scriptblock]$Assert
    )

    Write-Host "`n--- $Name ---" -ForegroundColor Yellow
    try {
        $h = if ($OverrideHeaders) { $OverrideHeaders } else { $headers }
        $params = @{
            Uri     = $Uri
            Method  = $Method
            Headers = $h
            UseBasicParsing = $true
        }
        if ($Body) { $params["Body"] = $Body }

        $resp = Invoke-WebRequest @params
        $json = $resp.Content | ConvertFrom-Json

        Write-Host "Status: $($resp.StatusCode)" -ForegroundColor Green
        Write-Host "Body  : $($resp.Content.Substring(0, [Math]::Min(500, $resp.Content.Length)))"

        if ($Assert) {
            & $Assert $json
        }

        $results[$Name] = "PASS"
    }
    catch {
        Write-Host "FAILED: $_" -ForegroundColor Red
        if ($_.Exception.Response) {
            try {
                $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
                Write-Host "Response: $($sr.ReadToEnd())" -ForegroundColor Red
            } catch {}
        }
        $results[$Name] = "FAIL"
    }
}

# 1-6: Health checks
@("content-scan", "scan-evidence", "scan-history", "scan-result", "report-scan", "quick-scan") | ForEach-Object {
    Invoke-Step -Name "Health: $_" -Method "GET" -Uri "$functionsBase/$($_)?health"
}

# 7: POST content-scan
Invoke-Step -Name "POST content-scan" -Method "POST" `
    -Uri "$functionsBase/content-scan" `
    -Body '{"url":"https://example.com"}' `
    -Assert {
        param($json)
        if (-not $json.scan_id) { throw "Missing scan_id in response" }
        $script:scanId = $json.scan_id
        Write-Host "Captured scan_id: $script:scanId" -ForegroundColor Cyan
        Write-Host "Badge: $($json.badge)  Score: $($json.score)  Cache: $($json.cache_hit)" -ForegroundColor Cyan
    }

# 8: GET scan-evidence
if ($scanId) {
    Invoke-Step -Name "GET scan-evidence" -Method "GET" `
        -Uri "$functionsBase/scan-evidence?scanId=$scanId" `
        -Assert {
            param($json)
            if (-not $json.evidence -or $json.evidence.Count -eq 0) {
                throw "Evidence array is empty or missing"
            }
            Write-Host "Evidence count: $($json.evidence.Count)" -ForegroundColor Cyan
            foreach ($e in $json.evidence) {
                Write-Host "  [$($e.status)] $($e.provider): $($e.summary)" -ForegroundColor DarkCyan
            }
        }
} else {
    Write-Host "`n--- GET scan-evidence --- SKIPPED (no scan_id)" -ForegroundColor DarkYellow
    $results["GET scan-evidence"] = "SKIP"
}

# 9: POST report-scan (different device to avoid rate limit)
$reportDeviceId = [guid]::NewGuid().ToString()
$reportHeaders = @{
    "Authorization" = "Bearer $anonKey"
    "apikey"        = $anonKey
    "X-Device-Id"   = $reportDeviceId
    "Content-Type"  = "application/json"
}

if ($scanId) {
    $reportBody = @{
        scan_id     = $scanId
        url         = "https://example.com"
        report_type = "safe"
        description = "Automated test report"
    } | ConvertTo-Json

    Invoke-Step -Name "POST report-scan" -Method "POST" `
        -Uri "$functionsBase/report-scan" `
        -Body $reportBody `
        -OverrideHeaders $reportHeaders `
        -Assert {
            param($json)
            if (-not $json.report_id) { throw "Missing report_id" }
            Write-Host "report_id: $($json.report_id)  total: $($json.total_reports)" -ForegroundColor Cyan
        }
} else {
    Write-Host "`n--- POST report-scan --- SKIPPED (no scan_id)" -ForegroundColor DarkYellow
    $results["POST report-scan"] = "SKIP"
}

# 10: GET quick-scan
Invoke-Step -Name "GET quick-scan" -Method "GET" `
    -Uri "$functionsBase/quick-scan?url=https://example.com" `
    -Assert {
        param($json)
        Write-Host "Badge: $($json.badge)  Score: $($json.score)  Cache: $($json.cache_hit)  Flags: $($json.top_red_flags.Count)" -ForegroundColor Cyan
    }

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$pass = 0; $fail = 0; $skip = 0
foreach ($kv in $results.GetEnumerator()) {
    $color = switch ($kv.Value) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        default { "DarkYellow" }
    }
    Write-Host ("  [{0}] {1}" -f $kv.Value, $kv.Key) -ForegroundColor $color
    switch ($kv.Value) { "PASS" { $pass++ } "FAIL" { $fail++ } default { $skip++ } }
}

Write-Host "`nTotal: $pass passed, $fail failed, $skip skipped" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 }
