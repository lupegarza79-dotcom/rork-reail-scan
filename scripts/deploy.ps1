#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)]
  [string]$FunctionName,
  [string]$ProjectRef = "favpzctusdjnnoyoabrz"
)

$ErrorActionPreference = "Stop"
Push-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
try {
  if (-not (Test-Path (Join-Path "supabase/functions" $FunctionName "index.ts"))) {
    throw "Function entrypoint not found: supabase/functions/$FunctionName/index.ts"
  }

  Write-Host "Deploying $FunctionName to $ProjectRef..." -ForegroundColor Cyan
  supabase functions deploy $FunctionName --project-ref $ProjectRef --no-verify-jwt
}
finally {
  Pop-Location
}
