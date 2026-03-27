#Requires -Version 5.1
<#
.SYNOPSIS
    REAiL Wallet Shield — Supabase operations script.
.DESCRIPTION
    Handles: login, link, migration list, migration repair, db push, deploy all functions.
.PARAMETER Action
    One of: login, link, status, repair, push, deploy, all
.NOTES
    Prerequisites: Node LTS, npm, supabase as devDependency
    Set env vars:
      SUPABASE_ACCESS_TOKEN   — personal access token
      SUPABASE_PROJECT_REF    — project ref id
.EXAMPLE
    pwsh scripts/supabase.ps1 -Action push
    pwsh scripts/supabase.ps1 -Action deploy
    pwsh scripts/supabase.ps1 -Action all
    pwsh scripts/supabase.ps1 -Action repair -MigrationVersion 20240203
#>
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("login", "link", "status", "repair", "push", "deploy", "all")]
    [string]$Action,

    [string]$MigrationVersion = ""
)

$ErrorActionPreference = "Stop"

$projectRef = $env:SUPABASE_PROJECT_REF

function Assert-ProjectRef {
    if (-not $projectRef) {
        Write-Error "SUPABASE_PROJECT_REF not set. Run:`n  `$env:SUPABASE_PROJECT_REF = '<your-ref>'"
        exit 1
    }
}

function Invoke-SbLogin {
    Write-Host "`n[Supabase] Login..." -ForegroundColor Cyan
    npx supabase login
}

function Invoke-SbLink {
    Assert-ProjectRef
    Write-Host "`n[Supabase] Linking to project: $projectRef" -ForegroundColor Cyan
    npx supabase link --project-ref $projectRef
}

function Invoke-SbStatus {
    Assert-ProjectRef
    Write-Host "`n[Supabase] Migration status:" -ForegroundColor Cyan
    npx supabase migration list --linked
}

function Invoke-SbRepair {
    Assert-ProjectRef
    if (-not $MigrationVersion) {
        Write-Host "`n[Supabase] Listing migrations to identify which to repair..." -ForegroundColor Cyan
        npx supabase migration list --linked
        Write-Host "`nTo baseline a migration, re-run with:"
        Write-Host "  pwsh scripts/supabase.ps1 -Action repair -MigrationVersion VERSION" -ForegroundColor Yellow
        Write-Host "`nExample: pwsh scripts/supabase.ps1 -Action repair -MigrationVersion 20240203" -ForegroundColor DarkCyan
        return
    }
    Write-Host "`n[Supabase] Repairing migration $MigrationVersion as applied (baseline)..." -ForegroundColor Cyan
    npx supabase migration repair --status applied $MigrationVersion --linked
    Write-Host "  OK — $MigrationVersion marked as applied" -ForegroundColor Green
}

function Invoke-SbPush {
    Assert-ProjectRef
    Write-Host "`n[Supabase] Pushing database migrations..." -ForegroundColor Cyan
    npx supabase db push --linked
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n  db push failed. If tables already exist, baseline with:" -ForegroundColor Red
        Write-Host "    pwsh scripts/supabase.ps1 -Action repair -MigrationVersion VERSION" -ForegroundColor Yellow
        Write-Host "  Then re-run: pwsh scripts/supabase.ps1 -Action push" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  OK" -ForegroundColor Green
}

function Invoke-SbDeploy {
    Assert-ProjectRef
    Write-Host "`n[Supabase] Deploying Edge Functions..." -ForegroundColor Cyan

    $functionsDir = Join-Path $PSScriptRoot ".." "supabase" "functions"
    $functionsDir = (Resolve-Path $functionsDir).Path

    $functionDirs = Get-ChildItem -Path $functionsDir -Directory | Where-Object { $_.Name -ne "_shared" }

    $expectedFunctions = @(
        "wallet-share",
        "money-case",
        "cache-cleanup",
        "quick-scan",
        "content-scan",
        "report-scan",
        "scan-result",
        "scan-evidence",
        "scan-history"
    )

    $deployed = @()
    $failed = @()

    foreach ($fn in $functionDirs) {
        Write-Host "  Deploying: $($fn.Name)..." -ForegroundColor DarkCyan
        try {
            npx supabase functions deploy $fn.Name --project-ref $projectRef --no-verify-jwt 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    OK" -ForegroundColor Green
                $deployed += $fn.Name
            } else {
                Write-Warning "    Failed: $($fn.Name)"
                $failed += $fn.Name
            }
        } catch {
            Write-Warning "    Failed: $($fn.Name) — $_"
            $failed += $fn.Name
        }
    }

    Write-Host "`n  Deployed: $($deployed.Count) functions" -ForegroundColor Green
    if ($failed.Count -gt 0) {
        Write-Host "  Failed: $($failed -join ', ')" -ForegroundColor Red
    }

    $missing = $expectedFunctions | Where-Object { $_ -notin ($functionDirs | ForEach-Object { $_.Name }) }
    if ($missing.Count -gt 0) {
        Write-Host "  Missing function dirs: $($missing -join ', ')" -ForegroundColor DarkYellow
    }
}

# --- Execute ---
switch ($Action) {
    "login"  { Invoke-SbLogin }
    "link"   { Invoke-SbLink }
    "status" { Invoke-SbStatus }
    "repair" { Invoke-SbRepair }
    "push"   { Invoke-SbPush }
    "deploy" { Invoke-SbDeploy }
    "all"    {
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "  Supabase Full Pipeline" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Invoke-SbPush
        Invoke-SbDeploy
        Write-Host "`n  All done." -ForegroundColor Green
    }
}
