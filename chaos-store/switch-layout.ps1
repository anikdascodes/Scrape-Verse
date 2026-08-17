# Switch chaos-store layout: copies layouts/vN.html → index.html, commits, pushes.
# Vercel (GitHub-integrated) auto-redeploys in ~15s. Usage: .\switch-layout.ps1 -Version 2
param([Parameter(Mandatory=$true)][ValidateSet(1,2,3)][int]$Version)

$root = Split-Path -Parent $PSScriptRoot
Copy-Item "$PSScriptRoot\layouts\v$Version.html" "$root\index.html" -Force
git -C $root add index.html
git -C $root commit -m "chore(chaos): switch store layout to v$Version"
git -C $root push
Write-Host "chaos store switched to v$Version — Vercel redeploying"
