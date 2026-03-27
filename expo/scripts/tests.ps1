#Requires -Version 5.1
param()

$ErrorActionPreference = "Stop"

# ----------------------------
# Load .env (project root)
# ----------------------------
function Load-DotEnvFile([string]$Path) {
  if (-not (Test-Path $Path)) { return }

  Write-Host "Loading environment from: $Path" -ForegroundColor DarkGray

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith("#")) { return }

    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }

    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()

    # Remove surrounding quotes if present
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }

    if (-not [string]::IsNullOrWhiteSpace($key)) {
      $existing = [Environment]::GetEnvironmentVariable($key, "Process")
      if (-not $existing) {
        [Environment]::SetEnvironmentVariable($key, $val, "Process")
      }
    }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath  = Join-Path $repoRoot ".env"
Load-DotEnvFile $envPath

# ----------------------------
# Resolve required settings
# ----------------------------
$projectUrl = $env:SUPABASE_PROJECT_URL
if (-not $projectUrl) { $projectUrl = $env:EXPO_PUBLIC_SUPABASE_URL }

$anonKey = $env:SUPABASE_ANON_KEY
if (-not $anonKey) { $anonKey = $env:EXPO_PUBLIC_SUPABASE_ANON_KEY }

$functionsBase = $env:FUNCTIONS_BASE_URL
if (-not $functionsBase) { $functionsBase = $env:EXPO_PUBLIC_API_URL }
if (-not $functionsBase -and $projectUrl) { $functionsBase = "$projectUrl/functions/v1" }

if (-not $projectUrl) { Write-Error "Missing env var SUPABASE_PROJECT_URL or EXPO_PUBLIC_SUPABASE_URL"; exit 1 }
if (-not $anonKey)    { Write-Error "Missing env var SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY"; exit 1 }
if (-not $functionsBase) { Write-Error "Missing env var FUNCTIONS_BASE_URL or EXPO_PUBLIC_API_URL"; exit 1 }

$functionsBase = $functionsBase.TrimEnd("/")

if (-not $anonKey.StartsWith("eyJ")) {
  Write-Warning "ANON key does not start with 'eyJ'. Make sure you used the 'anon public' JWT key (Legacy anon) from Supabase."
}

# ----------------------------
# HTTP helpers
# ----------------------------
$deviceId = ("ps1-" + [Guid]::NewGuid().ToString("N"))

$headers = @{
  "apikey"        = $anonKey
  "authorization" = "Bearer $anonKey"
  "x-device-id"   = $deviceId
}

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST")] [string]$Method,
    [Parameter(Mandatory=$true)] [string]$Url,
    [object]$Body = $null
  )

  $params = @{
    Method     = $Method
    Uri        = $Url
    Headers    = $headers
    TimeoutSec = 90
  }

  if ($Body -ne $null) {
    $params["ContentType"] = "application/json"
    $params["Body"] = ($Body | ConvertTo-Json -Depth 20)
  }

  try {
    $resp = Invoke-WebRequest @params
    $status  = [int]$resp.StatusCode
    $content = $resp.Content
  } catch {
    $status = 0
    $content = ""
    if ($_.Exception.Response) {
      try {
        $status = [int]$_.Exception.Response.StatusCode.value__
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $content = $reader.ReadToEnd()
      } catch { }
    } else {
      $content = $_.ToString()
    }
  }

  $json = $null
  try { $json = $content | ConvertFrom-Json } catch { }

  [pscustomobject]@{
    Status  = $status
    Content = $content
    Json    = $json
  }
}

$results = [ordered]@{}

function Run-Step {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][ValidateSet("GET","POST")] [string]$Method,
    [Parameter(Mandatory=$true)][string]$Url,
    [object]$Body = $null,
    [scriptblock]$OnOk = $null
  )

  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  Write-Host "$Method $Url" -ForegroundColor DarkGray

  $r = Invoke-JsonRequest -Method $Method -Url $Url -Body $Body

  if ($r.Status -ge 200 -and $r.Status -lt 300) {
    $results[$Name] = "PASS"
    Write-Host "Status: $($r.Status)" -ForegroundColor Green
    if ($r.Content) {
      $preview = $r.Content.Substring(0, [Math]::Min(400, $r.Content.Length))
      Write-Host "Body  : $preview" -ForegroundColor DarkGray
    }
    if ($OnOk -and $r.Json) { & $OnOk $r.Json }
    return $r
  } else {
    $results[$Name] = "FAIL"
    Write-Host "Status: $($r.Status)" -ForegroundColor Red
    if ($r.Content) { Write-Host $r.Content -ForegroundColor Red }
    return $r
  }
}

Write-Host "`nRepo: $repoRoot" -ForegroundColor DarkGray
Write-Host "Functions base: $functionsBase" -ForegroundColor DarkGray
Write-Host "Device-Id: $deviceId" -ForegroundColor DarkGray

# ----------------------------
# 0) Health checks (FIXED URL interpolation)
# ----------------------------
$healthEndpoints = @(
  "content-scan",
  "scan-result",
  "scan-evidence",
  "scan-history",
  "report-scan",
  "quick-scan",
  "wallet-share",
  "appeal",
  "claim"
)

foreach ($ep in $healthEndpoints) {
  # IMPORTANT: use $($ep) so PowerShell doesn't treat "?health" as part of a variable name
  Run-Step -Name "Health: $ep" -Method "GET" -Url "$functionsBase/$($ep)?health=1" | Out-Null
}

# ----------------------------
# 1) content-scan (creates scan_id)
# ----------------------------
$scanId = $null
$targetUrl = "https://example.com"

Run-Step -Name "POST content-scan" -Method "POST" -Url "$functionsBase/content-scan" -Body @{
  url = $targetUrl
} -OnOk {
  param($json)
  if ($json.scan_id) { $script:scanId = $json.scan_id }
  Write-Host "scan_id: $($script:scanId)" -ForegroundColor Cyan
} | Out-Null

# 2) scan-result/evidence/history
if ($scanId) {
  Run-Step -Name "GET scan-result" -Method "GET" -Url "$functionsBase/scan-result?scanId=$scanId" | Out-Null
  Run-Step -Name "GET scan-evidence" -Method "GET" -Url "$functionsBase/scan-evidence?scanId=$scanId" | Out-Null
  Run-Step -Name "GET scan-history" -Method "GET" -Url "$functionsBase/scan-history?scanId=$scanId" | Out-Null
} else {
  $results["GET scan-result"] = "SKIP"
  $results["GET scan-evidence"] = "SKIP"
  $results["GET scan-history"] = "SKIP"
}

# 3) report-scan
Run-Step -Name "POST report-scan" -Method "POST" -Url "$functionsBase/report-scan" -Body @{
  url = $targetUrl
  report_type = "scam"
  description = "test report"
  scan_id = $scanId
} | Out-Null

# 4) quick-scan (GET + POST)
Run-Step -Name "GET quick-scan" -Method "GET" -Url "$functionsBase/quick-scan?url=$([Uri]::EscapeDataString($targetUrl))" -OnOk {
  param($json)
  if ($json.trust -and $json.trust.reason_codes) {
    Write-Host "  reason_codes: $($json.trust.reason_codes -join ', ')" -ForegroundColor DarkGray
  }
  if ($json.providers.urlhaus) {
    Write-Host "  urlhaus verdict: $($json.providers.urlhaus.verdict)" -ForegroundColor DarkGray
  }
} | Out-Null
Run-Step -Name "POST quick-scan" -Method "POST" -Url "$functionsBase/quick-scan" -Body @{ url = $targetUrl } | Out-Null

# 5) wallet-share (POST to get token, then GET)
$shareToken = $null
Run-Step -Name "POST wallet-share" -Method "POST" -Url "$functionsBase/wallet-share" -Body @{
  url = $targetUrl
  expiry_hours = 24
} -OnOk {
  param($json)
  if ($json.token) { $script:shareToken = $json.token }
  Write-Host "token: $($script:shareToken)" -ForegroundColor Cyan
} | Out-Null

if ($shareToken) {
  Run-Step -Name "GET wallet-share" -Method "GET" -Url "$functionsBase/wallet-share?token=$shareToken" | Out-Null
} else {
  $results["GET wallet-share"] = "SKIP"
}

# 6) appeal
Run-Step -Name "POST appeal" -Method "POST" -Url "$functionsBase/appeal" -Body @{
  scan_id = $scanId
  message = "This is a test appeal message (>= 5 chars)."
  reason_type = "incorrect_classification"
  contact = "test@example.com"
  evidence_links = @("https://example.com/evidence")
} | Out-Null

# 7) claim
Run-Step -Name "POST claim" -Method "POST" -Url "$functionsBase/claim" -Body @{
  domain = "example.com"
  contact = "test@example.com"
  message = "This is a test claim message."
  evidence_links = @("https://example.com/evidence")
} | Out-Null

# ----------------------------
# 8) Smoke: quick-scan rate-limit (fire many requests)
# ----------------------------
Write-Host "`n=== Smoke: rate-limit shape ==" -ForegroundColor Cyan
Write-Host "Sending quick-scan to verify 429 shape is stable..." -ForegroundColor DarkGray
$rateLimitHit = $false
for ($i = 0; $i -lt 5; $i++) {
  $r = Invoke-JsonRequest -Method "GET" -Url "$functionsBase/quick-scan?url=$([Uri]::EscapeDataString($targetUrl))"
  if ($r.Status -eq 429) {
    $rateLimitHit = $true
    if ($r.Json.error_code -eq "rate_limit_exceeded" -and $r.Json.retry_after_seconds -ne $null -and $r.Json.rate_limit -ne $null) {
      $results["429 shape valid"] = "PASS"
      Write-Host "  429 JSON shape verified: error_code, retry_after_seconds, rate_limit present" -ForegroundColor Green
    } else {
      $results["429 shape valid"] = "FAIL"
      Write-Host "  429 JSON shape invalid" -ForegroundColor Red
    }
    break
  }
}
if (-not $rateLimitHit) {
  $results["429 shape valid"] = "SKIP"
  Write-Host "  Rate limit not hit in 5 requests (OK for low-volume test)" -ForegroundColor DarkYellow
}

# ----------------------------
# 9) Smoke: provider failure fallback
# ----------------------------
Write-Host "`n=== Smoke: provider fallback ==" -ForegroundColor Cyan
$maliciousUrl = "https://this-definitely-does-not-exist-xyz123.invalid"
$r = Invoke-JsonRequest -Method "POST" -Url "$functionsBase/quick-scan" -Body @{ url = $maliciousUrl }
if ($r.Status -ge 200 -and $r.Status -lt 300) {
  $results["Provider fallback"] = "PASS"
  Write-Host "  quick-scan returned OK even with unreachable URL (fail-soft working)" -ForegroundColor Green
} elseif ($r.Status -eq 429) {
  $results["Provider fallback"] = "SKIP"
  Write-Host "  Rate limited, skipping fallback test" -ForegroundColor DarkYellow
} else {
  $results["Provider fallback"] = "FAIL"
  Write-Host "  Expected 2xx but got $($r.Status)" -ForegroundColor Red
}

# ----------------------------
# 10) Smoke: share token path
# ----------------------------
if ($shareToken) {
  $r = Invoke-JsonRequest -Method "GET" -Url "$functionsBase/wallet-share?token=$shareToken"
  if ($r.Status -eq 200 -and $r.Json.ok -eq $true) {
    $results["Share token resolve"] = "PASS"
    Write-Host "`n=== Share token resolve ==" -ForegroundColor Cyan
    Write-Host "  Token resolved: badge=$($r.Json.badge) score=$($r.Json.score)" -ForegroundColor Green
  } else {
    $results["Share token resolve"] = "FAIL"
  }
} else {
  $results["Share token resolve"] = "SKIP"
}

# ----------------------------
# Summary
# ----------------------------
$pass = 0; $fail = 0; $skip = 0
Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
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
