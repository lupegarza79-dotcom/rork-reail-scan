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

# ============================================================
# SECTION 1: Health checks for all endpoints
# ============================================================
Write-Host "`n=== HEALTH CHECKS ===" -ForegroundColor Magenta

$publicEndpoints = @(
    "content-scan", "scan-evidence", "scan-history", "scan-result",
    "report-scan", "quick-scan", "wallet-share", "appeal", "claim",
    "cache-cleanup"
)
$internalEndpoints = @(
    "audit-run", "trustops-resolve-appeal", "trustops-verify-claim",
    "outcome-update", "notify-send"
)

foreach ($ep in $publicEndpoints + $internalEndpoints) {
    Invoke-Step -Name "Health: $ep" -Method "GET" -Uri "$functionsBase/$($ep)?health"
}

# ============================================================
# SECTION 2: Public endpoint functional tests
# ============================================================
Write-Host "`n=== PUBLIC ENDPOINT TESTS ===" -ForegroundColor Magenta

# 1: POST content-scan
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

# 2: GET scan-result
if ($scanId) {
    Invoke-Step -Name "GET scan-result" -Method "GET" `
        -Uri "$functionsBase/scan-result?id=$scanId" `
        -Assert {
            param($json)
            Write-Host "Badge: $($json.badge)  Score: $($json.score)" -ForegroundColor Cyan
        }
} else {
    Write-Host "`n--- GET scan-result --- SKIPPED (no scan_id)" -ForegroundColor DarkYellow
    $results["GET scan-result"] = "SKIP"
}

# 3: GET scan-evidence
if ($scanId) {
    Invoke-Step -Name "GET scan-evidence" -Method "GET" `
        -Uri "$functionsBase/scan-evidence?id=$scanId" `
        -Assert {
            param($json)
            if ($json.evidence) {
                Write-Host "Evidence count: $($json.evidence.Count)" -ForegroundColor Cyan
            } else {
                Write-Host "Evidence: (none or different format)" -ForegroundColor DarkYellow
            }
        }
} else {
    Write-Host "`n--- GET scan-evidence --- SKIPPED (no scan_id)" -ForegroundColor DarkYellow
    $results["GET scan-evidence"] = "SKIP"
}

# 4: GET scan-history
Invoke-Step -Name "GET scan-history" -Method "GET" `
    -Uri "$functionsBase/scan-history?device_id=$deviceId&limit=10" `
    -Assert {
        param($json)
        Write-Host "Items: $($json.items.Count)  Total: $($json.total)" -ForegroundColor Cyan
    }

# 5: POST report-scan (use different device to avoid rate limit)
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

# 6: GET quick-scan
Invoke-Step -Name "GET quick-scan" -Method "GET" `
    -Uri "$functionsBase/quick-scan?url=https://example.com" `
    -Assert {
        param($json)
        Write-Host "Badge: $($json.badge)  Score: $($json.score)  Cache: $($json.cache_hit)" -ForegroundColor Cyan
    }

# 7: POST quick-scan
Invoke-Step -Name "POST quick-scan" -Method "POST" `
    -Uri "$functionsBase/quick-scan" `
    -Body '{"input":"https://example.com","input_type":"url","share":false}' `
    -Assert {
        param($json)
        Write-Host "Badge: $($json.badge)  Score: $($json.score)" -ForegroundColor Cyan
    }

# 8: POST wallet-share (create share link)
$shareToken = $null
Invoke-Step -Name "POST wallet-share" -Method "POST" `
    -Uri "$functionsBase/wallet-share" `
    -Body '{"url":"https://example.com","expiry_hours":24}' `
    -Assert {
        param($json)
        if ($json.token) {
            $script:shareToken = $json.token
            Write-Host "Token: $($json.token)  Badge: $($json.badge)" -ForegroundColor Cyan
        } else {
            Write-Host "No token returned" -ForegroundColor DarkYellow
        }
    }

# 9: GET wallet-share (resolve share link)
if ($shareToken) {
    Invoke-Step -Name "GET wallet-share" -Method "GET" `
        -Uri "$functionsBase/wallet-share?token=$shareToken" `
        -Assert {
            param($json)
            Write-Host "Domain: $($json.domain)  Badge: $($json.badge)  Views: $($json.view_count)" -ForegroundColor Cyan
        }
} else {
    Write-Host "`n--- GET wallet-share --- SKIPPED (no share token)" -ForegroundColor DarkYellow
    $results["GET wallet-share"] = "SKIP"
}

# 10: POST appeal
$appealDeviceId = [guid]::NewGuid().ToString()
$appealHeaders = @{
    "Authorization" = "Bearer $anonKey"
    "apikey"        = $anonKey
    "X-Device-Id"   = $appealDeviceId
    "Content-Type"  = "application/json"
}
$appealBody = @{
    scan_id     = $scanId
    reason_type = "incorrect_classification"
    message     = "Automated test appeal - this domain is safe"
    contact     = "test@example.com"
} | ConvertTo-Json

Invoke-Step -Name "POST appeal" -Method "POST" `
    -Uri "$functionsBase/appeal" `
    -Body $appealBody `
    -OverrideHeaders $appealHeaders `
    -Assert {
        param($json)
        if ($json.appeal_id) {
            Write-Host "appeal_id: $($json.appeal_id)  status: $($json.status)" -ForegroundColor Cyan
        }
    }

# 11: POST claim
$claimDeviceId = [guid]::NewGuid().ToString()
$claimHeaders = @{
    "Authorization" = "Bearer $anonKey"
    "apikey"        = $anonKey
    "X-Device-Id"   = $claimDeviceId
    "Content-Type"  = "application/json"
}
$claimBody = @{
    domain       = "example.com"
    contact      = "owner@example.com"
    proof_method = "documentation"
    message      = "Automated test claim"
} | ConvertTo-Json

Invoke-Step -Name "POST claim" -Method "POST" `
    -Uri "$functionsBase/claim" `
    -Body $claimBody `
    -OverrideHeaders $claimHeaders `
    -Assert {
        param($json)
        if ($json.claim_id) {
            Write-Host "claim_id: $($json.claim_id)  status: $($json.status)" -ForegroundColor Cyan
        }
    }

# 12: POST cache-cleanup
Invoke-Step -Name "POST cache-cleanup" -Method "POST" `
    -Uri "$functionsBase/cache-cleanup" `
    -Body '{}' `
    -Assert {
        param($json)
        Write-Host "Method: $($json.method)  Result: $($json.result)" -ForegroundColor Cyan
    }

# ============================================================
# SECTION 3: Internal endpoint health (service-role would be needed for full test)
# ============================================================
Write-Host "`n=== INTERNAL ENDPOINTS (health only with anon key) ===" -ForegroundColor Magenta

foreach ($ep in $internalEndpoints) {
    Invoke-Step -Name "Internal health: $ep" -Method "GET" -Uri "$functionsBase/$($ep)?health"
}

# ============================================================
# SUMMARY
# ============================================================
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
