#Requires -Version 5.1
param(
  [ValidateSet("login", "link", "db-dry-run", "db-push")]
  [string]$Action = "db-dry-run",
  [string]$ProjectRef = "favpzctusdjnnoyoabrz"
)

$ErrorActionPreference = "Stop"
Push-Location (Resolve-Path (Join-Path $PSScriptRoot ".."))
try {
  switch ($Action) {
    "login" {
      supabase login
    }
    "link" {
      supabase link --project-ref $ProjectRef
    }
    "db-dry-run" {
      supabase db push --linked --dry-run
    }
    "db-push" {
      supabase db push --linked
    }
  }
}
finally {
  Pop-Location
}
