@echo off
setlocal
pushd "%~dp0"
title World Tree

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 18 or newer from https://nodejs.org
  pause
  exit /b 1
)

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set WT_VERSION=%%v
echo World Tree v%WT_VERSION%
echo Starting safely. If port 3000 is occupied, another available port will be used.
echo No existing process will be terminated.
echo.

node scripts\start-local.mjs
set EXIT_CODE=%ERRORLEVEL%
popd
exit /b %EXIT_CODE%
