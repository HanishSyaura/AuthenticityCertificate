@echo off
setlocal enabledelayedexpansion

echo === Setting environment variables ===
set PLAYWRIGHT_BROWSERS_PATH=c:\Users\USER\Desktop\DemoCertNFC\AuthenticityCertificate\frontend\pw-browsers
set PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
set PLAYWRIGHT_API_BASE=http://127.0.0.1:5000

echo PLAYWRIGHT_BROWSERS_PATH: %PLAYWRIGHT_BROWSERS_PATH%
echo PLAYWRIGHT_BASE_URL: %PLAYWRIGHT_BASE_URL%
echo PLAYWRIGHT_API_BASE: %PLAYWRIGHT_API_BASE%

cd /d "c:\Users\USER\Desktop\DemoCertNFC\AuthenticityCertificate\frontend"
echo === Working directory: %CD% ===

if not exist "node_modules" (
    echo === node_modules not found, running npm install ===
    call npm.cmd install
    if errorlevel 1 (
        echo npm install failed with error code !errorlevel!
        exit /b !errorlevel!
    )
)

set PLAYWRIGHT_CMD=c:\Users\USER\Desktop\DemoCertNFC\AuthenticityCertificate\frontend\node_modules\.bin\playwright.cmd

if not exist "%PLAYWRIGHT_CMD%" (
    echo === playwright.cmd not found at %PLAYWRIGHT_CMD%, trying npx ===
    echo === Running Playwright tests via npx ===
    call npx.cmd playwright test --config=playwright.config.js --project=chromium --workers=1 --timeout=120000 e2e/05-admin-modules.spec.js
    set EXIT_CODE=!errorlevel!
) else (
    echo === Running Playwright tests via direct path ===
    call "%PLAYWRIGHT_CMD%" test --config=playwright.config.js --project=chromium --workers=1 --timeout=120000 e2e/05-admin-modules.spec.js
    set EXIT_CODE=!errorlevel!
)

echo === Playwright exited with code: !EXIT_CODE! ===
exit /b !EXIT_CODE!
