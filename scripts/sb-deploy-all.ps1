#Requires -Version 5.1
param(
  [string]$ProjectRef = "favpzctusdjnnoyoabrz"
)

$ErrorActionPreference = "Stop"
Push-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
try {
  $functions = @(
    "content-scan",
    "scan-evidence",
    "scan-result",
    "scan-history",
    "report-scan",
    "quick-scan",
    "cache-cleanup"
  )

  foreach ($fn in $functions) {
    Write-Host "Deploying $fn..." -ForegroundColor Cyan
    supabase functions deploy $fn --project-ref $ProjectRef --no-verify-jwt
  }
}
finally {
  Pop-Location
}
