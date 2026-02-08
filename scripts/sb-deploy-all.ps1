#Requires -Version 5.1
<#
.SYNOPSIS
    Deploy ALL Supabase Edge Functions found under supabase/functions/*.
.NOTES
    Requires: SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF env vars.
    Usage: npm run sb:deploy
#>
param()

$ErrorActionPreference = "Stop"

$projectRef = $env:SUPABASE_PROJECT_REF
if (-not $projectRef) {
    Write-Error "Missing env var SUPABASE_PROJECT_REF. Set it before running."
    exit 1
}

$functionsDir = Join-Path $PSScriptRoot ".." "supabase" "functions"
$functionsDir = (Resolve-Path $functionsDir).Path

$functionDirs = Get-ChildItem -Path $functionsDir -Directory | Where-Object { $_.Name -ne "_shared" }

if ($functionDirs.Count -eq 0) {
    Write-Host "No functions found under supabase/functions/ — nothing to deploy." -ForegroundColor DarkYellow
    exit 0
}

Write-Host "`nDeploying $($functionDirs.Count) Edge Function(s)...`n" -ForegroundColor Cyan

$failed = 0
foreach ($fn in $functionDirs) {
    Write-Host "  -> $($fn.Name)" -ForegroundColor Yellow -NoNewline
    try {
        npx supabase functions deploy $fn.Name --project-ref $projectRef --no-verify-jwt 2>&1 | Out-Null
        Write-Host "  OK" -ForegroundColor Green
    } catch {
        Write-Host "  FAILED: $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`nDone. $($functionDirs.Count - $failed)/$($functionDirs.Count) deployed.`n" -ForegroundColor Cyan
if ($failed -gt 0) { exit 1 }
