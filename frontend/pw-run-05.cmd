@echo off

echo ======================================== > "%~dp0pw-run.log"
echo Playwright Test Run - 05-admin-modules >> "%~dp0pw-run.log"
echo Date: %date% %time% >> "%~dp0pw-run.log"
echo ======================================== >> "%~dp0pw-run.log"

set PLAYWRIGHT_BROWSERS_PATH=c:\Users\USER\Desktop\DemoCertNFC\AuthenticityCertificate\frontend\pw-browsers
set PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
set PLAYWRIGHT_API_BASE=http://127.0.0.1:5000

echo PLAYWRIGHT_BROWSERS_PATH=%PLAYWRIGHT_BROWSERS_PATH% >> "%~dp0pw-run.log"
echo PLAYWRIGHT_BASE_URL=%PLAYWRIGHT_BASE_URL% >> "%~dp0pw-run.log"
echo PLAYWRIGHT_API_BASE=%PLAYWRIGHT_API_BASE% >> "%~dp0pw-run.log"

cd /d "c:\Users\USER\Desktop\DemoCertNFC\AuthenticityCertificate\frontend"

echo Current dir: %CD% >> "%~dp0pw-run.log"
echo. >> "%~dp0pw-run.log"

echo Checking playwright.cmd exists: >> "%~dp0pw-run.log"
if exist "c:\Users\USER\Desktop\DemoCertNFC\AuthenticityCertificate\frontend\node_modules\.bin\playwright.cmd" (
    echo FOUND: playwright.cmd >> "%~dp0pw-run.log"
) else (
    echo MISSING: playwright.cmd >> "%~dp0pw-run.log"
)
echo. >> "%~dp0pw-run.log"

echo === Running Playwright tests === >> "%~dp0pw-run.log"
call "c:\Users\USER\Desktop\DemoCertNFC\AuthenticityCertificate\frontend\node_modules\.bin\playwright.cmd" test --config=playwright.config.js --project=chromium --workers=1 --timeout=120000 e2e/05-admin-modules.spec.js >> "%~dp0pw-run.log" 2>&1
set EXIT_CODE=%ERRORLEVEL%
echo ================================ >> "%~dp0pw-run.log"
echo. >> "%~dp0pw-run.log"
echo PLAYWRIGHT_EXIT_CODE=%EXIT_CODE% >> "%~dp0pw-run.log"
echo. >> "%~dp0pw-run.log"

if %EXIT_CODE% EQU 0 (
    echo RESULT: PASS >> "%~dp0pw-run.log"
) else (
    echo RESULT: FAIL >> "%~dp0pw-run.log"
)

exit /b %EXIT_CODE%
