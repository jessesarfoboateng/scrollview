#!/usr/bin/env pwsh
# ScrollView Setup Script
# Run from: c:\Users\jesse\Documents\scrollview\
# Usage: .\setup.ps1

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n=== Installing Backend Dependencies ===" -ForegroundColor Cyan
Set-Location "$Root\backend"
npm install

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Start backend:  cd backend && npm start"   -ForegroundColor Yellow
Write-Host "Start frontend: cd frontend && npm run dev" -ForegroundColor Yellow
