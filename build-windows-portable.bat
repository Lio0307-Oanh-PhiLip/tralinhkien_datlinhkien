@echo off
title Build OPPO Label Studio - Portable (.exe)
echo ====================================================================
echo  Building OPPO Label Studio Portable (.exe)...
echo ====================================================================

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js / npm not found on your system.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [1/3] Installing dependencies...
call npm install

echo.
echo [2/3] Generating Windows Icons and Building Web App...
call node generate_all_icons.cjs
call npm run build

echo.
echo [3/3] Packaging Portable (.exe)...
call npx electron-builder --win portable --config electron-builder.json
if %errorlevel% neq 0 (
    echo [ERROR] Packaging failed.
    pause
    exit /b 1
)

echo.
echo ====================================================================
echo  PORTABLE EXECUTABLE CREATED SUCCESSFULLY!
echo  Location: release\OPPO-Label-Studio-Portable-1.0.0.exe
echo ====================================================================
echo.
pause
