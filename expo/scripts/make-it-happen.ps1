#Requires -Version 5.1
<#
.SYNOPSIS
    REAiL Wallet Shield — one-shot operational script.
    git pull -> npm install -> sb push -> deploy functions -> start app.
.NOTES
    Prerequisites: Node LTS, npm, git, PowerShell 5.1+
    Set these env vars before running:
      SUPABASE_ACCESS_TOKEN   — personal access token
      SUPABASE_PROJECT_REF    — project ref id
#>
param()

$ErrorActionPreference = "Stop"

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  REAiL — Make It Happen (Node + npm)" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# --- Step 1: git pull ---
Write-Host "[1/5] Pulling latest from remote..." -ForegroundColor Yellow
try {
    git pull --rebase 2>&1 | ForEach-Object { Write-Host "  $_" }
    Write-Host "  OK`n" -ForegroundColor Green
} catch {
    Write-Warning "git pull failed — continuing with local state. $_"
}

# --- Step 2: npm install ---
Write-Host "[2/5] Installing dependencies (npm install)..." -ForegroundColor Yellow
npm install 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install failed (exit $LASTEXITCODE)"
    exit 1
}
Write-Host "  OK`n" -ForegroundColor Green

# --- Step 3: Validate env ---
Write-Host "[3/5] Validating environment..." -ForegroundColor Yellow

$accessToken = $env:SUPABASE_ACCESS_TOKEN
$projectRef  = $env:SUPABASE_PROJECT_REF

$missing = @()
if (-not $accessToken) { $missing += "SUPABASE_ACCESS_TOKEN" }
if (-not $projectRef)  { $missing += "SUPABASE_PROJECT_REF" }

if ($missing.Count -gt 0) {
    Write-Warning ("Skipping Supabase steps — missing env vars: {0}" -f ($missing -join ", "))
    Write-Host "  Set them to enable db push + function deploy.`n" -ForegroundColor DarkYellow

    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  Skipped Supabase. Starting app..." -ForegroundColor Yellow
    Write-Host "============================================`n" -ForegroundColor Cyan
    npm run start
    exit 0
}

Write-Host "  Project ref : $projectRef" -ForegroundColor DarkCyan
Write-Host "  Access token: (set)" -ForegroundColor DarkCyan
Write-Host "  OK`n" -ForegroundColor Green

# --- Step 4: Supabase db push ---
Write-Host "[4/5] Pushing database migrations..." -ForegroundColor Yellow
try {
    npx supabase db push --project-ref $projectRef 2>&1 | ForEach-Object { Write-Host "  $_" }
    Write-Host "  OK`n" -ForegroundColor Green
} catch {
    Write-Warning "supabase db push failed: $_ — continuing anyway"
}

# --- Step 5: Deploy Edge Functions ---
Write-Host "[5/5] Deploying Edge Functions..." -ForegroundColor Yellow

$functionsDir = Join-Path $PSScriptRoot ".." "supabase" "functions"
$functionsDir = (Resolve-Path $functionsDir).Path

$functionDirs = Get-ChildItem -Path $functionsDir -Directory | Where-Object { $_.Name -ne "_shared" }

if ($functionDirs.Count -eq 0) {
    Write-Host "  No functions found — skipping`n" -ForegroundColor DarkYellow
} else {
    foreach ($fn in $functionDirs) {
        Write-Host "  Deploying: $($fn.Name)..." -ForegroundColor DarkCyan -NoNewline
        try {
            npx supabase functions deploy $fn.Name --project-ref $projectRef --no-verify-jwt 2>&1 | Out-Null
            Write-Host " OK" -ForegroundColor Green
        } catch {
            Write-Warning "  Failed: $($fn.Name): $_"
        }
    }
    Write-Host ""
}

# --- Done — start app ---
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  All steps complete! Starting app..." -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Cyan

npm run start
