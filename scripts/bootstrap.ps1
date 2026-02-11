#Requires -Version 5.1
param(
  [string]$ProjectRef = "favpzctusdjnnoyoabrz"
)

$ErrorActionPreference = "Stop"
Push-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
try {
  if (-not (Test-Path ".git")) {
    throw "Run this inside the repository root (missing .git)."
  }

  if (-not (Test-Path "supabase/config.toml")) {
    throw "Missing supabase/config.toml. Are you in the right repository?"
  }

  Write-Host "Repo root OK: $(Get-Location)" -ForegroundColor Green
  Write-Host "\nRun these commands in order:" -ForegroundColor Cyan
  Write-Host "supabase login"
  Write-Host "supabase link --project-ref $ProjectRef"
  Write-Host "supabase db push --linked --dry-run"
  Write-Host "supabase db push --linked"
  Write-Host "powershell -ExecutionPolicy Bypass -File .\\scripts\\sb-deploy-all.ps1 -ProjectRef $ProjectRef"
  Write-Host "powershell -ExecutionPolicy Bypass -File .\\scripts\\tests.ps1"

  if (Test-Path "supabase/.temp/project-ref") {
    $linkedRef = (Get-Content "supabase/.temp/project-ref" -Raw).Trim()
    Write-Host "\nLinked project ref detected: $linkedRef" -ForegroundColor Green
  } else {
    Write-Warning "No linked project ref detected yet (supabase/.temp/project-ref missing)."
  }
}
finally {
  Pop-Location
}
