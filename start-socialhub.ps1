# Starts SocialHub's backend, frontend, and (optionally) an ngrok tunnel for local
# development. Assumes backend/.venv, frontend/node_modules, and both .env files already
# exist -- run the manual setup in README.md first if this is a fresh clone.
#
# ngrok is for DEVELOPMENT TESTING ONLY (e.g. testing an OAuth redirect from another
# device, or a provider that needs a public HTTPS URL). Never point production
# FRONTEND_URL/BACKEND_URL at an ngrok tunnel -- use real domains in .env.production.
# Pass -NoNgrok to skip launching it.

param(
    [switch]$NoNgrok
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $backendDir ".venv\Scripts\Activate.ps1"))) {
    Write-Host "backend\.venv not found. Run first: cd backend; python -m venv .venv; .venv\Scripts\Activate.ps1; pip install -r requirements.txt" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $backendDir ".env"))) {
    Write-Host "backend\.env not found. Copy backend\.env.example to backend\.env and fill in real values first." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "frontend\node_modules not found. Run 'npm install' in frontend\ first." -ForegroundColor Red
    exit 1
}

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cd '$backendDir'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "cd '$frontendDir'; npm run dev"

if (-not $NoNgrok) {
    # Dev-only convenience tunnel -- see docs/meta-oauth-setup.md section 7 for why this
    # requires re-registering the redirect URI + updating .env each time ngrok restarts.
    Start-Process powershell -ArgumentList "-NoExit", "-Command", `
        "ngrok http 5173"
}

Write-Host ""
Write-Host "SocialHub started:" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:8000/docs"
Write-Host "  Frontend: http://localhost:5173"
if (-not $NoNgrok) {
    Write-Host "  ngrok:    check its window for the forwarding HTTPS URL (dev-only -- see docs/meta-oauth-setup.md)"
}
