#Requires -Version 5.1
<#
.SYNOPSIS
    REAiL Wallet Shield — full deploy script (Node + npm, no Bun required).
.DESCRIPTION
    1. git pull
    2. Validates required environment variables
    3. Runs npx supabase db push
    4. Deploys all Edge Functions under supabase/functions/*
    5. Starts the Expo app
.NOTES
    Prerequisites: Node LTS, npm, git, PowerShell 5.1+
    Set these env vars before running:
      SUPABASE_ACCESS_TOKEN   — personal access token (supabase.com/dashboard/account/tokens)
      SUPABASE_PROJECT_REF    — project ref id (from project settings)
#>
param()

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  REAiL Deploy Script (Node + npm)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# --- Step 1: git pull ---
Write-Host "[1/5] Pulling latest from remote..." -ForegroundColor Yellow
try {
    git pull --rebase
    Write-Host "  OK" -ForegroundColor Green
} catch {
    Write-Warning "git pull failed — continuing with local state. Error: $_"
}

# --- Step 2: Validate env ---
Write-Host "`n[2/5] Validating environment..." -ForegroundColor Yellow

$accessToken = $env:SUPABASE_ACCESS_TOKEN
$projectRef  = $env:SUPABASE_PROJECT_REF

$missing = @()
if (-not $accessToken) { $missing += "SUPABASE_ACCESS_TOKEN" }
if (-not $projectRef)  { $missing += "SUPABASE_PROJECT_REF" }

if ($missing.Count -gt 0) {
    Write-Error ("Missing required env vars: {0}`nSet them before running this script." -f ($missing -join ", "))
    exit 1
}

Write-Host "  Project ref : $projectRef" -ForegroundColor DarkCyan
Write-Host "  Access token: (set)" -ForegroundColor DarkCyan
Write-Host "  OK" -ForegroundColor Green

# --- Step 3: npm install (if needed) ---
Write-Host "`n[3/5] Ensuring dependencies are installed..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "  node_modules not found — running npm install..."
    npm install
} else {
    Write-Host "  node_modules exists — skipping npm install (run manually if needed)"
}
Write-Host "  OK" -ForegroundColor Green

# --- Step 4: Supabase db push ---
Write-Host "`n[4/5] Pushing database migrations..." -ForegroundColor Yellow
try {
    npx supabase db push --project-ref $projectRef
    Write-Host "  OK" -ForegroundColor Green
} catch {
    Write-Error "supabase db push failed: $_"
    exit 1
}

# --- Step 5: Deploy Edge Functions ---
Write-Host "`n[5/5] Deploying Edge Functions..." -ForegroundColor Yellow

$functionsDir = Join-Path $PSScriptRoot ".." "supabase" "functions"
$functionsDir = (Resolve-Path $functionsDir).Path

$functionDirs = Get-ChildItem -Path $functionsDir -Directory | Where-Object { $_.Name -ne "_shared" }

if ($functionDirs.Count -eq 0) {
    Write-Host "  No functions found under supabase/functions/ — skipping" -ForegroundColor DarkYellow
} else {
    foreach ($fn in $functionDirs) {
        Write-Host "  Deploying: $($fn.Name)..." -ForegroundColor DarkCyan
        try {
            npx supabase functions deploy $fn.Name --project-ref $projectRef --no-verify-jwt
            Write-Host "    OK" -ForegroundColor Green
        } catch {
            Write-Warning "  Failed to deploy $($fn.Name): $_"
        }
    }
}

# --- Done ---
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Deploy complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nStarting the app with: npm run start`n" -ForegroundColor Yellow

npm run start
