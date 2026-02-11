#Requires -Version 5.1
param()

$ErrorActionPreference = "Stop"
Push-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
try {
  $errors = @()

  if (-not (Test-Path ".git")) { $errors += "Missing .git (not at repo root)." }
  if (-not (Test-Path "supabase/config.toml")) { $errors += "Missing supabase/config.toml." }

  try { supabase --version | Out-Null } catch { $errors += "Supabase CLI not found in PATH." }

  try {
    docker info | Out-Null
  } catch {
    $errors += "Docker is not running (start Docker Desktop)."
  }

  if (-not (Test-Path "supabase/.temp/project-ref")) {
    $errors += "Project is not linked. Run: supabase link --project-ref favpzctusdjnnoyoabrz"
  }

  $requiredFunctions = @("content-scan","scan-evidence","scan-result","scan-history","report-scan","quick-scan","cache-cleanup")
  foreach ($fn in $requiredFunctions) {
    if (-not (Test-Path (Join-Path "supabase/functions" $fn "index.ts"))) {
      $errors += "Missing function entrypoint: supabase/functions/$fn/index.ts"
    }
  }

  Write-Host "Git status:" -ForegroundColor Cyan
  git status --short

  if ($errors.Count -gt 0) {
    Write-Host "\nDoctor found issues:" -ForegroundColor Red
    $errors | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    exit 1
  }

  Write-Host "\nDoctor check passed." -ForegroundColor Green
}
finally {
  Pop-Location
}
