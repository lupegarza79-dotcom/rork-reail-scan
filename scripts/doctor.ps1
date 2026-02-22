@'
param(
  [ValidateSet("local","ci")] [string]$Mode = "local",
  [string]$ProjectRef = "favpzctusdjnnoyoabrz",
  [string]$Base = "",
  [string]$Anon = "",
  [string]$DeviceId = "doctor-001",
  [switch]$SkipRateLimit
)

$ErrorActionPreference = "Stop"

function Write-Row($name, $status, $detail=""){
  $pad = 18
  "{0,-$pad} [{1}] {2}" -f $name, $status, $detail
}

function Load-DotEnv($path){
  if(!(Test-Path $path)){ return }
  Get-Content $path | ForEach-Object {
    $line = $_
    if($line -match '^\s*#' -or $line -notmatch '='){ return }
    $k,$v = $line -split '=',2
    $v = $v.Trim().Trim('"')
    if($k){ Set-Item -Path ("Env:"+$k.Trim()) -Value $v }
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Load-DotEnv (Join-Path $repoRoot ".env")

if([string]::IsNullOrWhiteSpace($Anon)){ $Anon = $env:EXPO_PUBLIC_SUPABASE_ANON_KEY }
if([string]::IsNullOrWhiteSpace($Base)){ $Base = $env:EXPO_PUBLIC_API_URL }
if([string]::IsNullOrWhiteSpace($Base)){ $Base = "https://$ProjectRef.supabase.co/functions/v1" }

# normalize Base
$Base = $Base.TrimEnd("/")

$allPass = $true
$results = @()

# 0) Preconditions
if([string]::IsNullOrWhiteSpace($Anon)){
  $results += Write-Row "ENV" "FAIL" "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY"
  $allPass = $false
} else {
  $results += Write-Row "ENV" "PASS" ("Base="+$Base)
}

# 1) Functions list (inventory)
try{
  $out = & npx supabase functions list --project-ref $ProjectRef 2>&1
  if($LASTEXITCODE -ne 0){ throw $out }
  $core = @("content-scan","quick-scan","scan-evidence","scan-result","scan-history","report-scan","cache-cleanup")
  $missing = @()
  foreach($f in $core){
    if($out -notmatch [regex]::Escape($f)){ $missing += $f }
  }
  if($missing.Count -gt 0){
    $results += Write-Row "Functions list" "FAIL" ("Missing: "+($missing -join ", "))
    $allPass = $false
  } else {
    $results += Write-Row "Functions list" "PASS" "Core 7 present"
  }
}catch{
  $results += Write-Row "Functions list" "FAIL" "npx supabase functions list failed"
  $results += ($_ | Out-String)
  $allPass = $false
}

# 2) Health checks (core 7)
$healthFns = @("quick-scan","content-scan","scan-result","scan-evidence","scan-history","report-scan","cache-cleanup")
foreach($f in $healthFns){
  try{
    $tmp = Join-Path $env:TEMP ("reail_health_"+$f+".json")
    $url = "$Base/$f?health=1"
    $code = curl.exe --ssl-no-revoke -sS -o $tmp -w "%{http_code}" `
      -H "apikey: $Anon" `
      -H "Authorization: Bearer $Anon" `
      -H "x-device-id: $DeviceId" `
      $url
    $raw = Get-Content $tmp -Raw
    $ok = $null
    try { $j = $raw | ConvertFrom-Json; $ok = $j.ok } catch { $ok = "non-json" }

    if($code -eq "200" -and ($ok -eq $true -or $ok -eq "true")){
      $results += Write-Row ("Health "+$f) "PASS" ("HTTP "+$code)
    } else {
      $results += Write-Row ("Health "+$f) "FAIL" ("HTTP "+$code+" ok="+$ok)
      $allPass = $false
    }
  }catch{
    $results += Write-Row ("Health "+$f) "FAIL" "Exception"
    $results += ($_ | Out-String)
    $allPass = $false
  }
}

# 3) E2E tests
try{
  $testsPath = Join-Path $PSScriptRoot "tests.ps1"
  if(!(Test-Path $testsPath)){
    $results += Write-Row "tests.ps1" "FAIL" "scripts/tests.ps1 not found"
    $allPass = $false
  } else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $testsPath
    if($LASTEXITCODE -eq 0){
      $results += Write-Row "tests.ps1" "PASS" "exit=0"
    } else {
      $results += Write-Row "tests.ps1" "FAIL" ("exit="+$LASTEXITCODE)
      $allPass = $false
    }
  }
}catch{
  $results += Write-Row "tests.ps1" "FAIL" "Exception"
  $results += ($_ | Out-String)
  $allPass = $false
}

# 4) Rate-limit 429 shape (local only by default)
if($Mode -eq "ci" -or $SkipRateLimit){
  $results += Write-Row "429 shape" "SKIP" "Mode=$Mode SkipRateLimit=$SkipRateLimit"
} else {
  try{
    $hit = $false
    $target = "https://example.com"
    for($i=1;$i -le 200;$i++){
      $tmp = Join-Path $env:TEMP "reail_rl_body.json"
      $code = curl.exe --ssl-no-revoke -sS -o $tmp -w "%{http_code}" `
        -H "apikey: $Anon" `
        -H "Authorization: Bearer $Anon" `
        -H "x-device-id: rl-doctor-001" `
        --get --data-urlencode ("url="+$target) `
        "$Base/quick-scan"

      if($code -eq "429"){
        $hit = $true
        $raw = Get-Content $tmp -Raw
        $j = $raw | ConvertFrom-Json
        $ok = ($j.ok -eq $false)
        $shape = ($j.error_code -eq "rate_limit_exceeded") -and ($j.retry_after_seconds -ge 0) -and ($j.rate_limit.limit -ge 1) -and ($j.rate_limit.window_seconds -ge 1)
        if($ok -and $shape){
          $results += Write-Row "429 shape" "PASS" ("hit at #"+$i)
        } else {
          $results += Write-Row "429 shape" "FAIL" "bad shape"
          $allPass = $false
        }
        break
      }
    }
    if(-not $hit){
      $results += Write-Row "429 shape" "FAIL" "No 429 in 200 requests"
      $allPass = $false
    }
  }catch{
    $results += Write-Row "429 shape" "FAIL" "Exception"
    $results += ($_ | Out-String)
    $allPass = $false
  }
}

"`n=== DOCTOR SUMMARY ==="
$results | ForEach-Object { $_ }

if($allPass){
  "`nRESULT: PASS"
  exit 0
} else {
  "`nRESULT: FAIL"
  exit 1
}
'@ | Set-Content -Encoding UTF8 .\scripts\doctor.ps1