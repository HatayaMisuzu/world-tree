@echo off
pushd %~dp0
title World Tree Desktop

echo.
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set WT_VERSION=%%v
echo World Tree Desktop v%WT_VERSION%
echo =====================
echo.

:: Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js
node --version

:: Kill old processes on port 3000
echo.
echo [1/3] Cleaning up...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>nul
)
timeout /t 1 /nobreak >nul

:: Start server
echo [2/3] Starting server...
start /B node server.js

:: Wait for port (max 15 seconds)
set WAIT=15
:waitloop
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if not errorlevel 1 goto server_ready
set /a WAIT=WAIT-1
if %WAIT% gtr 0 goto waitloop

echo.
echo [TIMEOUT] Server did not start in 15 seconds
echo Please check: http://localhost:3000
pause
exit /b

:server_ready
echo [3/3] Opening browser...
start "" "http://localhost:3000"

echo.
echo [DONE] Server is ready
echo Open: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.
pause
popd
