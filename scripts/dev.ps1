#Requires -Version 5.1
<#
.SYNOPSIS
    REAiL Wallet Shield — Windows dev script (Node + npm, no Bun).
.DESCRIPTION
    1. git pull (if git available)
    2. npm install (if needed)
    3. Start Expo with tunnel mode
.NOTES
    Prerequisites: Node LTS (20+), npm
#>
param(
    [switch]$Web,
    [switch]$NoPull,
    [switch]$Clear
)

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  REAiL Dev Script (Node + npm)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# --- Step 1: git pull ---
if (-not $NoPull) {
    Write-Host "[1/3] Pulling latest..." -ForegroundColor Yellow
    try {
        $gitCheck = Get-Command git -ErrorAction SilentlyContinue
        if ($gitCheck) {
            git pull --rebase 2>$null
            Write-Host "  OK" -ForegroundColor Green
        } else {
            Write-Host "  git not found — skipping pull" -ForegroundColor DarkYellow
        }
    } catch {
        Write-Warning "git pull failed — continuing with local state."
    }
} else {
    Write-Host "[1/3] Skipping git pull (--NoPull)" -ForegroundColor DarkYellow
}

# --- Step 2: npm install ---
Write-Host "`n[2/3] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "  node_modules not found — running npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed. Try: npm run clean-install"
        exit 1
    }
} else {
    Write-Host "  node_modules exists — OK"
}
Write-Host "  OK" -ForegroundColor Green

# --- Step 3: Start app ---
Write-Host "`n[3/3] Starting Expo..." -ForegroundColor Yellow

$startCmd = "npx expo start --tunnel"
if ($Web) {
    $startCmd = "npx expo start --web --tunnel"
    Write-Host "  Mode: Web" -ForegroundColor DarkCyan
} else {
    Write-Host "  Mode: Native (tunnel)" -ForegroundColor DarkCyan
}

if ($Clear) {
    $startCmd += " --clear"
    Write-Host "  Cache: cleared" -ForegroundColor DarkCyan
}

Write-Host "  Running: $startCmd`n" -ForegroundColor DarkCyan
Invoke-Expression $startCmd
